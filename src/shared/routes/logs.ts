import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { listLogsResponseSchema, deleteLogsResponseSchema } from "../responses/logs.js";

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
    response: listLogsResponseSchema
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
    response: deleteLogsResponseSchema
});
