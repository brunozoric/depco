import { z } from "zod";

export const scanScheduleSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    interval: z.string(),
    lastRunAt: z.number().nullable(),
    nextRunAt: z.number().nullable(),
    enabled: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const resolvedScheduleSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    interval: z.string(),
    source: z.enum(["project", "default"]),
    lastRunAt: z.number().nullable(),
    nextRunAt: z.number().nullable()
});

export const listScanSchedulesResponseSchema = z.object({
    items: z.array(resolvedScheduleSchema),
    globalDefault: z.string()
});

export const upsertScanScheduleResponseSchema = z.object({ item: scanScheduleSchema });

export const getScanScheduleDefaultResponseSchema = z.object({
    item: z.object({ interval: z.string() })
});

export const upsertScanScheduleDefaultResponseSchema = z.object({
    item: z.object({ interval: z.string() })
});
