import { eq, sql, type SQL } from "drizzle-orm";
import { autoFixPullRequests } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";

export interface IAutoFixPullRequestFilters {
    projectId?: string | undefined;
    status?: string | undefined;
    teamId?: string | undefined;
}

export function buildAutoFixPullRequestConditions(filters: IAutoFixPullRequestFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.projectId) {
        conditions.push(eq(autoFixPullRequests.projectId, filters.projectId));
    }
    if (filters.status) {
        conditions.push(eq(autoFixPullRequests.status, filters.status));
    }
    if (filters.teamId) {
        conditions.push(sql`${autoFixPullRequests.projectId} IN ${teamProjectIds(filters.teamId)}`);
    }
    return conditions;
}
