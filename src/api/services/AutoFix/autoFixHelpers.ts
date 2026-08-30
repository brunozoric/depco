import type { scanResults } from "#api/db/schema.js";

type ScanResultRow = typeof scanResults.$inferSelect;

export interface IResolvedScanResultRow extends Omit<
    ScanResultRow,
    "latestVersion" | "upgradeType"
> {
    latestVersion: string;
    upgradeType: string;
}

export function isResolvedScanResult(row: ScanResultRow): row is IResolvedScanResultRow {
    return row.latestVersion !== null && row.upgradeType !== null;
}

export interface IEligiblePackage {
    packageName: string;
    fromVersion: string;
    toVersion: string;
    upgradeType: string;
    licenseWarnings: string[];
}

export interface IPackageGroup {
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
        return upgradeTypes.values().next().value!;
    }
    return "mixed";
}

export function groupPackages(
    packages: IEligiblePackage[],
    groupingStrategy: string
): IPackageGroup[] {
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

    return packages.map(pkg => ({
        packages: [pkg],
        upgradeType: pkg.upgradeType,
        branchSlug: `${toBranchSlug(pkg.packageName)}-${pkg.toVersion}`
    }));
}

interface IUpgradeTableEntry {
    packageName: string;
    fromVersion: string;
    toVersion: string;
    upgradeType: string;
}

export function buildUpgradeTable(packages: IUpgradeTableEntry[]): string[] {
    const lines = ["| Package | From | To | Type |", "| --- | --- | --- | --- |"];
    for (const pkg of packages) {
        lines.push(
            `| ${pkg.packageName} | ${pkg.fromVersion} | ${pkg.toVersion} | ${pkg.upgradeType} |`
        );
    }
    return lines;
}
