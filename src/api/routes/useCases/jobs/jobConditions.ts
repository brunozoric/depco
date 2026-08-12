import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { upgradeJobs } from "#api/db/schema.js";

export interface IJobFilters {
    status?: string | undefined;
    type?: string | undefined;
    referenceId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}

export interface ICountRow {
    count: number;
}

export function buildJobConditions(filters: IJobFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.status) {
        conditions.push(eq(upgradeJobs.status, filters.status));
    }
    if (filters.type) {
        conditions.push(eq(upgradeJobs.type, filters.type));
    }
    if (filters.referenceId) {
        conditions.push(eq(upgradeJobs.referenceId, filters.referenceId));
    }
    if (filters.from) {
        conditions.push(gte(upgradeJobs.startedAt, parseInt(filters.from, 10)));
    }
    if (filters.to) {
        conditions.push(lte(upgradeJobs.startedAt, parseInt(filters.to, 10)));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
}
