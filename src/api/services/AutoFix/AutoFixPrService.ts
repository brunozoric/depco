import { and, eq, or } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AutoFixPrService as Abstraction } from "./abstractions/AutoFixPrService.js";
import { AutoFixSettingsService } from "./abstractions/AutoFixSettingsService.js";
import { LicensePolicyService } from "../License/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults, autoFixPullRequests, licenses } from "#api/db/schema.js";
import {
    isResolvedScanResult,
    groupPackages,
    buildUpgradeTable,
    type IEligiblePackage
} from "./autoFixHelpers.js";

const OPEN_PULL_REQUEST_STATUSES = ["pending", "created"];

export class AutoFixPrServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly autoFixSettingsService: AutoFixSettingsService.Interface,
        private readonly licensePolicyService: LicensePolicyService.Interface
    ) {}

    public async generateForProject(projectId: string): Promise<Abstraction.GenerateResult> {
        const settings = await this.autoFixSettingsService.getSettingsOrDefaults(projectId);

        const scanRows = await this.databaseClient.db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, projectId))
            .all();

        const candidates = scanRows
            .filter(isResolvedScanResult)
            .filter(
                row => row.upgradeType !== "none" && settings.upgradeTypes.includes(row.upgradeType)
            );

        if (candidates.length === 0) {
            return { pending: [], skippedDeny: [], skippedDuplicate: [] };
        }

        const { eligiblePackages, skippedDeny } = await this.evaluateLicenses(
            projectId,
            candidates
        );

        const { finalPackages, skippedDuplicate } = await this.filterDuplicates(
            projectId,
            eligiblePackages
        );

        if (finalPackages.length === 0) {
            return { pending: [], skippedDeny, skippedDuplicate };
        }

        const groups = groupPackages(finalPackages, settings.groupingStrategy);
        const pending = await this.insertPendingRecords(projectId, groups, settings.branchPrefix);

        return { pending, skippedDeny, skippedDuplicate };
    }

    private async evaluateLicenses(
        projectId: string,
        candidates: {
            name: string;
            currentVersion: string;
            latestVersion: string;
            upgradeType: string;
        }[]
    ): Promise<{ eligiblePackages: IEligiblePackage[]; skippedDeny: string[] }> {
        const licenseRows = await this.databaseClient.db
            .select()
            .from(licenses)
            .where(eq(licenses.projectId, projectId))
            .all();
        const licenseByPackageName = new Map(licenseRows.map(row => [row.packageName, row]));

        const licenseInputs = candidates
            .map(candidate => licenseByPackageName.get(candidate.name))
            .filter((row): row is NonNullable<typeof row> => row !== undefined)
            .map(row => ({
                id: row.id,
                packageName: row.packageName,
                spdxId: row.spdxId,
                licenseName: row.licenseName
            }));

        const allViolations =
            licenseInputs.length > 0
                ? await this.licensePolicyService.evaluate(projectId, licenseInputs)
                : [];

        const violationsByPackage = new Map<string, typeof allViolations>();
        for (const violation of allViolations) {
            const existing = violationsByPackage.get(violation.packageName) ?? [];
            existing.push(violation);
            violationsByPackage.set(violation.packageName, existing);
        }

        const skippedDeny: string[] = [];
        const eligiblePackages: IEligiblePackage[] = [];

        for (const candidate of candidates) {
            const violations = violationsByPackage.get(candidate.name) ?? [];
            const licenseRow = licenseByPackageName.get(candidate.name);

            if (violations.some(violation => violation.action === "deny")) {
                skippedDeny.push(candidate.name);
                continue;
            }

            const licenseWarnings = violations
                .filter(violation => violation.action === "warn")
                .map(
                    () =>
                        `${candidate.name}: license ${licenseRow?.spdxId ?? licenseRow?.licenseName} flagged for review`
                );

            eligiblePackages.push({
                packageName: candidate.name,
                fromVersion: candidate.currentVersion,
                toVersion: candidate.latestVersion,
                upgradeType: candidate.upgradeType,
                licenseWarnings
            });
        }

        return { eligiblePackages, skippedDeny };
    }

    private async filterDuplicates(
        projectId: string,
        eligiblePackages: IEligiblePackage[]
    ): Promise<{ finalPackages: IEligiblePackage[]; skippedDuplicate: string[] }> {
        const existingPullRequestRows = await this.databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(
                and(
                    eq(autoFixPullRequests.projectId, projectId),
                    or(
                        ...OPEN_PULL_REQUEST_STATUSES.map(status =>
                            eq(autoFixPullRequests.status, status)
                        )
                    )
                )
            )
            .all();

        const coveredPackageNames = new Set<string>();
        for (const row of existingPullRequestRows) {
            const packageNames = JSON.parse(row.packageNames) as string[];
            for (const packageName of packageNames) {
                coveredPackageNames.add(packageName);
            }
        }

        const skippedDuplicate: string[] = [];
        const finalPackages: IEligiblePackage[] = [];
        for (const pkg of eligiblePackages) {
            if (coveredPackageNames.has(pkg.packageName)) {
                skippedDuplicate.push(pkg.packageName);
                continue;
            }
            finalPackages.push(pkg);
        }

        return { finalPackages, skippedDuplicate };
    }

    private async insertPendingRecords(
        projectId: string,
        groups: { packages: IEligiblePackage[]; upgradeType: string; branchSlug: string }[],
        branchPrefix: string
    ): Promise<Abstraction.PullRequestRecord[]> {
        const now = Date.now();
        const pending: Abstraction.PullRequestRecord[] = [];

        for (const group of groups) {
            const packageNames = group.packages.map(pkg => pkg.packageName);
            const fromVersions: Record<string, string> = {};
            const toVersions: Record<string, string> = {};
            const licenseWarnings: string[] = [];

            for (const pkg of group.packages) {
                fromVersions[pkg.packageName] = pkg.fromVersion;
                toVersions[pkg.packageName] = pkg.toVersion;
                licenseWarnings.push(...pkg.licenseWarnings);
            }

            const branchName = branchPrefix + group.branchSlug;

            const existingBranchRow = await this.databaseClient.db
                .select()
                .from(autoFixPullRequests)
                .where(
                    and(
                        eq(autoFixPullRequests.projectId, projectId),
                        eq(autoFixPullRequests.branchName, branchName)
                    )
                )
                .get();

            if (existingBranchRow) {
                if (OPEN_PULL_REQUEST_STATUSES.includes(existingBranchRow.status)) {
                    continue;
                }
                await this.databaseClient.db
                    .delete(autoFixPullRequests)
                    .where(eq(autoFixPullRequests.id, existingBranchRow.id))
                    .run();
            }

            const id = generateId();

            await this.databaseClient.db
                .insert(autoFixPullRequests)
                .values({
                    id,
                    projectId,
                    packageNames: JSON.stringify(packageNames),
                    fromVersions: JSON.stringify(fromVersions),
                    toVersions: JSON.stringify(toVersions),
                    upgradeType: group.upgradeType,
                    branchName,
                    status: "pending",
                    licenseWarnings:
                        licenseWarnings.length > 0 ? JSON.stringify(licenseWarnings) : null,
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            pending.push({
                id,
                projectId,
                packageNames,
                fromVersions,
                toVersions,
                upgradeType: group.upgradeType,
                branchName,
                status: "pending",
                licenseWarnings
            });
        }

        return pending;
    }

    public buildPrBody(
        packages: Abstraction.PackageUpgrade[],
        changelogExcerpts: Abstraction.ChangelogExcerpt[],
        licenseWarnings: string[]
    ): string {
        const lines: string[] = ["## Dependency Upgrade", "", ...buildUpgradeTable(packages)];

        if (changelogExcerpts.length > 0) {
            lines.push("", "## Changelog");
            for (const excerpt of changelogExcerpts) {
                lines.push(
                    "",
                    `### ${excerpt.packageName}@${excerpt.version}`,
                    excerpt.content ?? "_No changelog available._"
                );
            }
        }

        if (licenseWarnings.length > 0) {
            lines.push("", "## License Warnings");
            for (const warning of licenseWarnings) {
                lines.push(`- ${warning}`);
            }
        }

        lines.push("", "---", "*Generated by Dependency Manager*");

        return lines.join("\n");
    }
}

export const AutoFixPrService = Abstraction.createImplementation({
    implementation: AutoFixPrServiceImpl,
    dependencies: [DatabaseClient, AutoFixSettingsService, LicensePolicyService]
});
