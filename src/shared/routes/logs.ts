import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const appLogSchema = z.object({
    id: z.string(),
    level: z.string(),
    source: z.string(),
    projectId: z.string().nullable(),
    message: z.string(),
    details: z.string().nullable(),
    createdAt: z.number()
});

export const listLogsRoute = defineRoute({
    method: "GET",
    path: "/api/logs",
    description: "List app logs with optional filters",
    params: z.object({}),
    querystring: z.object({
        level: z.string().optional(),
        source: z.string().optional(),
        projectId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.string().optional(),
        offset: z.string().optional()
    }),
    response: z.object({
        items: z.array(appLogSchema),
        total: z.number()
    })
});

export const deleteLogsRoute = defineRoute({
    method: "DELETE",
    path: "/api/logs",
    description: "Bulk delete app logs with optional filters",
    params: z.object({}),
    body: z.object({
        level: z.string().optional(),
        source: z.string().optional(),
        projectId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    response: z.object({
        deleted: z.number()
    })
});
