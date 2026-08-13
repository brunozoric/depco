import type { autoFixPullRequests } from "#api/db/schema.js";

export interface IAutoFixPullRequestListItem {
    id: string;
    projectId: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    prUrl: string | null;
    prNumber: number | null;
    status: string;
    licenseWarnings: string[];
    createdAt: number;
    updatedAt: number;
}

export function rowToPullRequestListItem(
    row: typeof autoFixPullRequests.$inferSelect
): IAutoFixPullRequestListItem {
    return {
        id: row.id,
        projectId: row.projectId,
        packageNames: JSON.parse(row.packageNames) as string[],
        fromVersions: JSON.parse(row.fromVersions) as Record<string, string>,
        toVersions: JSON.parse(row.toVersions) as Record<string, string>,
        upgradeType: row.upgradeType,
        branchName: row.branchName,
        prUrl: row.prUrl,
        prNumber: row.prNumber,
        status: row.status,
        licenseWarnings: row.licenseWarnings ? (JSON.parse(row.licenseWarnings) as string[]) : [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
