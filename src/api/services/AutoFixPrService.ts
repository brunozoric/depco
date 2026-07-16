import { and, eq, or } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AutoFixPrService as Abstraction } from "./abstractions/AutoFixPrService.js";
import { AutoFixSettingsService } from "./abstractions/AutoFixSettingsService.js";
import { LicensePolicyService } from "./abstractions/LicensePolicyService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults, autoFixPullRequests, licenses } from "#api/db/schema.js";

const OPEN_PULL_REQUEST_STATUSES = ["pending", "created"];

type ScanResultRow = typeof scanResults.$inferSelect;

interface IResolvedScanResultRow extends Omit<ScanResultRow, "latestVersion" | "upgradeType"> {
    latestVersion: string;
    upgradeType: string;
}

function isResolvedScanResult(row: ScanResultRow): row is IResolvedScanResultRow {
    return row.latestVersion !== null && row.upgradeType !== null;
}

interface IEligiblePackage {
    packageName: string;
    fromVersion: string;
    toVersion: string;
    upgradeType: string;
    licenseWarnings: string[];
}

interface IPackageGroup {
    packages: IEligiblePackage[];
    upgradeType: string;
    branchSlug: string;
}

function toBranchSlug(packageName: string): string {
    return packageName.replace(/^@/, "").replace(/\//g, "-");
}

function combinedUpgradeType(packages: IEligiblePackage[]): string {
    const upgradeTypes = new Set(packages.map(pkg => pkg.upgradeType));
    if (upgradeTypes.size === 1) {
        return [...upgradeTypes][0]!;
    }
    return "mixed";
}

function groupPackages(packages: IEligiblePackage[], groupingStrategy: string): IPackageGroup[] {
    if (groupingStrategy === "per-project") {
        return [
            {
                packages,
                upgradeType: combinedUpgradeType(packages),
                branchSlug: "all-upgrades"
            }
        ];
    }

    if (groupingStrategy === "per-upgrade-type") {
        const packagesByUpgradeType = new Map<string, IEligiblePackage[]>();
        for (const pkg of packages) {
            const group = packagesByUpgradeType.get(pkg.upgradeType) ?? [];
            group.push(pkg);
            packagesByUpgradeType.set(pkg.upgradeType, group);
        }
        return Array.from(packagesByUpgradeType.entries()).map(([upgradeType, groupPackages]) => ({
            packages: groupPackages,
            upgradeType,
            branchSlug: `${upgradeType}-upgrades`
        }));
    }

    // Default strategy: "per-package".
    return packages.map(pkg => ({
        packages: [pkg],
        upgradeType: pkg.upgradeType,
        branchSlug: `${toBranchSlug(pkg.packageName)}-${pkg.toVersion}`
    }));
}

function buildUpgradeTable(packages: Abstraction.PackageUpgrade[]): string[] {
    const lines = ["| Package | From | To | Type |", "| --- | --- | --- | --- |"];
    for (const pkg of packages) {
        lines.push(
            `| ${pkg.packageName} | ${pkg.fromVersion} | ${pkg.toVersion} | ${pkg.upgradeType} |`
        );
    }
    return lines;
}

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

        const licenseRows = await this.databaseClient.db
            .select()
            .from(licenses)
            .where(eq(licenses.projectId, projectId))
            .all();
        const licenseByPackageName = new Map(licenseRows.map(row => [row.packageName, row]));

        const skippedDeny: string[] = [];
        const eligiblePackages: IEligiblePackage[] = [];

        for (const candidate of candidates) {
            const licenseRow = licenseByPackageName.get(candidate.name);
            let licenseWarnings: string[] = [];

            if (licenseRow) {
                const violations = await this.licensePolicyService.evaluate(projectId, [
                    {
                        id: licenseRow.id,
                        packageName: licenseRow.packageName,
                        spdxId: licenseRow.spdxId,
                        licenseName: licenseRow.licenseName
                    }
                ]);

                if (violations.some(violation => violation.action === "deny")) {
                    skippedDeny.push(candidate.name);
                    continue;
                }

                licenseWarnings = violations
                    .filter(violation => violation.action === "warn")
                    .map(
                        () =>
                            `${candidate.name}: license ${licenseRow.spdxId ?? licenseRow.licenseName} flagged for review`
                    );
            }

            eligiblePackages.push({
                packageName: candidate.name,
                fromVersion: candidate.currentVersion,
                toVersion: candidate.latestVersion,
                upgradeType: candidate.upgradeType,
                licenseWarnings
            });
        }

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

        if (finalPackages.length === 0) {
            return { pending: [], skippedDeny, skippedDuplicate };
        }

        const groups = groupPackages(finalPackages, settings.groupingStrategy);
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

            const branchName = settings.branchPrefix + group.branchSlug;

            // Static grouping strategies ("per-project", "per-upgrade-type")
            // reuse the same branch name across calls, and the table has a
            // unique (projectId, branchName) constraint. The duplicate check
            // above only catches packages already covered by a pending/
            // created PR, so a group can still collide here when the
            // branch's prior record moved on to a terminal state (or when
            // new packages join a group whose branch name is unaffected by
            // package composition). Resolve that before inserting.
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
                    // Already covered by an open PR on this branch — skip.
                    continue;
                }
                // Stale record ("failed", "merged", "closed") — replace it.
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

        return { pending, skippedDeny, skippedDuplicate };
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
