import type { scanSchedules } from "#api/db/schema.js";

export const SCAN_SCHEDULE_DEFAULT_KEY = "scan_schedule_default";

export interface IResolvedScanScheduleResponse {
    projectId: string;
    projectName: string;
    interval: string;
    source: "project" | "default";
    lastRunAt: number | null;
    nextRunAt: number | null;
}

export interface IScanScheduleResponse {
    id: string;
    projectId: string;
    interval: string;
    lastRunAt: number | null;
    nextRunAt: number | null;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

export function toScanScheduleResponse(
    row: typeof scanSchedules.$inferSelect
): IScanScheduleResponse {
    return {
        id: row.id,
        projectId: row.projectId,
        interval: row.interval,
        lastRunAt: row.lastRunAt,
        nextRunAt: row.nextRunAt,
        enabled: row.enabled === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
