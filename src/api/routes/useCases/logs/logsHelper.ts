import type { SQL } from "drizzle-orm";
import { and, eq, gte, lte } from "drizzle-orm";
import { appLogs } from "#api/db/schema.js";

export type IAppLogRecord = typeof appLogs.$inferSelect;

export interface ILogFilters {
    level?: string | undefined;
    source?: string | undefined;
    projectId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}

export function buildLogConditions(filters: ILogFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.level) {
        conditions.push(eq(appLogs.level, filters.level));
    }
    if (filters.source) {
        conditions.push(eq(appLogs.source, filters.source));
    }
    if (filters.projectId) {
        conditions.push(eq(appLogs.projectId, filters.projectId));
    }
    if (filters.from) {
        conditions.push(gte(appLogs.createdAt, parseInt(filters.from, 10)));
    }
    if (filters.to) {
        conditions.push(lte(appLogs.createdAt, parseInt(filters.to, 10)));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
}
