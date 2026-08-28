import { z } from "zod";

export const appLogSchema = z.object({
    id: z.string(),
    level: z.string(),
    source: z.string(),
    projectId: z.string().nullable(),
    message: z.string(),
    details: z.string().nullable(),
    createdAt: z.number()
});

export const listLogsResponseSchema = z.object({
    items: z.array(appLogSchema),
    total: z.number()
});

export const deleteLogsResponseSchema = z.object({
    deleted: z.number()
});
