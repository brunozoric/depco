import picomatch from "picomatch";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { LicensePolicyService as Abstraction } from "./abstractions/LicensePolicyService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules, licenses, licenseViolations } from "#api/db/schema.js";

function matchesGlob(value: string, pattern: string): boolean {
    return picomatch(pattern)(value);
}

function extractOrComponents(spdxId: string): string[] {
    const cleaned = spdxId.replace(/^\(/, "").replace(/\)$/, "");
    return cleaned
        .split(/\s+OR\s+/)
        .map(component => component.trim())
        .filter(Boolean);
}

function actionSeverity(action: "allow" | "warn" | "deny"): number {
    if (action === "allow") {
        return 0;
    }
    if (action === "warn") {
        return 1;
    }
    return 2;
}

interface IMatchedRule {
    id: string;
    action: "allow" | "warn" | "deny";
    priority: number;
    isProjectScoped: boolean;
}

type PolicyRuleRow = typeof licensePolicyRules.$inferSelect;

class LicensePolicyServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async evaluate(
        projectId: string,
        licenseInputs: Abstraction.LicenseInput[]
    ): Promise<Abstraction.Violation[]> {
        const rules = await this.databaseClient.db
            .select()
            .from(licensePolicyRules)
            .where(
                or(
                    isNull(licensePolicyRules.projectId),
                    eq(licensePolicyRules.projectId, projectId)
                )
            )
            .all();

        const violations: Abstraction.Violation[] = [];

        if (rules.length > 0) {
            for (const license of licenseInputs) {
                const violation = this.evaluateSingleLicense(projectId, license, rules);
                if (violation) {
                    violations.push(violation);
                }
            }
        }

        await this.persistViolations(projectId, licenseInputs, violations);

        return violations;
    }

    /**
     * Persists violations for licenses that already have a row in the
     * `licenses` table (i.e. have been scanned and stored). `evaluate()` is
     * also usable as a pure, in-memory policy check against license inputs
     * that were never persisted (e.g. a dry-run) — those are simply skipped
     * here to avoid violating the `license_violations` foreign keys.
     */
    private async persistViolations(
        projectId: string,
        licenseInputs: Abstraction.LicenseInput[],
        violations: Abstraction.Violation[]
    ): Promise<void> {
        const licenseIds = licenseInputs.map(license => license.id);

        if (licenseIds.length === 0) {
            return;
        }

        const persistedLicenses = await this.databaseClient.db
            .select({ id: licenses.id })
            .from(licenses)
            .where(and(eq(licenses.projectId, projectId), inArray(licenses.id, licenseIds)))
            .all();
        const persistedLicenseIds = persistedLicenses.map(license => license.id);

        if (persistedLicenseIds.length === 0) {
            return;
        }

        const persistableViolations = violations.filter(violation =>
            persistedLicenseIds.includes(violation.licenseId)
        );
        const now = Date.now();

        await this.databaseClient.db.transaction(async tx => {
            await tx
                .delete(licenseViolations)
                .where(
                    and(
                        eq(licenseViolations.projectId, projectId),
                        inArray(licenseViolations.licenseId, persistedLicenseIds)
                    )
                )
                .run();

            if (persistableViolations.length === 0) {
                return;
            }

            await tx
                .insert(licenseViolations)
                .values(
                    persistableViolations.map(violation => ({
                        id: generateId(),
                        licenseId: violation.licenseId,
                        ruleId: violation.ruleId,
                        projectId: violation.projectId,
                        packageName: violation.packageName,
                        action: violation.action,
                        scannedAt: now
                    }))
                )
                .run();
        });
    }

    private evaluateSingleLicense(
        projectId: string,
        license: Abstraction.LicenseInput,
        rules: PolicyRuleRow[]
    ): Abstraction.Violation | null {
        const spdxId = license.spdxId ?? license.licenseName;
        const isOrExpression = spdxId.includes(" OR ");
        const components = isOrExpression ? extractOrComponents(spdxId) : [spdxId];

        const componentResults = components.map(component =>
            this.findBestMatch(component, license.packageName, rules)
        );

        // A `null` result means no rule matched that component, which
        // defaults to "allow". If any OR component is allowed (explicitly
        // or by default), the whole license expression is allowed — the
        // license holder can rely on that one component's terms.
        const hasAllow = componentResults.some(
            result => result === null || result.action === "allow"
        );
        if (hasAllow) {
            return null;
        }

        // No component is allowed. Every result here is non-null (a `null`
        // would have short-circuited above). For an OR expression, the most
        // permissive matching component wins — i.e. the one with the lowest
        // severity ("warn" beats "deny") — regardless of which component
        // appears first in the SPDX string.
        const matchedResults = componentResults.filter(
            (result): result is IMatchedRule => result !== null
        );
        const bestMatch = matchedResults.reduce((leastSevere, current) =>
            actionSeverity(current.action) < actionSeverity(leastSevere.action)
                ? current
                : leastSevere
        );

        return {
            licenseId: license.id,
            ruleId: bestMatch.id,
            projectId,
            packageName: license.packageName,
            // `hasAllow` above already ruled out "allow" for every result.
            action: bestMatch.action as "warn" | "deny"
        };
    }

    private findBestMatch(
        spdxComponent: string,
        packageName: string,
        rules: PolicyRuleRow[]
    ): IMatchedRule | null {
        const matching: IMatchedRule[] = [];

        for (const rule of rules) {
            const licenseMatches =
                rule.licensePattern === null || matchesGlob(spdxComponent, rule.licensePattern);
            const packageMatches =
                rule.packagePattern === null || matchesGlob(packageName, rule.packagePattern);

            if (licenseMatches && packageMatches) {
                matching.push({
                    id: rule.id,
                    action: rule.action as "allow" | "warn" | "deny",
                    priority: rule.priority,
                    isProjectScoped: rule.projectId !== null
                });
            }
        }

        if (matching.length === 0) {
            return null;
        }

        matching.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return (b.isProjectScoped ? 1 : 0) - (a.isProjectScoped ? 1 : 0);
        });

        return matching[0]!;
    }

    public async getComplianceStatus(projectId: string): Promise<Abstraction.ComplianceStatus> {
        const allLicenses = await this.databaseClient.db
            .select()
            .from(licenses)
            .where(eq(licenses.projectId, projectId))
            .all();

        const allViolations = await this.databaseClient.db
            .select()
            .from(licenseViolations)
            .where(eq(licenseViolations.projectId, projectId))
            .all();

        const warned = allViolations.filter(violation => violation.action === "warn").length;
        const denied = allViolations.filter(violation => violation.action === "deny").length;

        return {
            total: allLicenses.length,
            allowed: allLicenses.length - warned - denied,
            warned,
            denied
        };
    }
}

export { LicensePolicyServiceImpl };

export const LicensePolicyService = Abstraction.createImplementation({
    implementation: LicensePolicyServiceImpl,
    dependencies: [DatabaseClient]
});
