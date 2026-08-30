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

function safeParseJson<T>(json: string | null, fallback: T): T {
    if (json == null) {
        return fallback;
    }
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

export function rowToPullRequestListItem(
    row: typeof autoFixPullRequests.$inferSelect
): IAutoFixPullRequestListItem {
    return {
        id: row.id,
        projectId: row.projectId,
        packageNames: safeParseJson<string[]>(row.packageNames, []),
        fromVersions: safeParseJson<Record<string, string>>(row.fromVersions, {}),
        toVersions: safeParseJson<Record<string, string>>(row.toVersions, {}),
        upgradeType: row.upgradeType,
        branchName: row.branchName,
        prUrl: row.prUrl,
        prNumber: row.prNumber,
        status: row.status,
        licenseWarnings: safeParseJson<string[]>(row.licenseWarnings, []),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
