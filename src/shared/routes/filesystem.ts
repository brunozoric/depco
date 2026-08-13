import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    browseFilesystemResponseSchema,
    scanFilesystemResponseSchema
} from "../responses/filesystem.js";

export const browseFilesystemRoute = defineRoute({
    method: "GET",
    path: "/api/filesystem/browse",
    description: "Browse directories at a given path",
    params: z.object({}),
    querystring: z.object({
        path: z.string().optional(),
        showHidden: z.string().optional()
    }),
    response: browseFilesystemResponseSchema
});

export const scanFilesystemRoute = defineRoute({
    method: "GET",
    path: "/api/filesystem/scan",
    description: "Scan directory for subdirectories containing package.json",
    params: z.object({}),
    querystring: z.object({
        path: z.string(),
        depth: z.coerce.number().int().min(1).max(5).optional().default(1)
    }),
    response: scanFilesystemResponseSchema
});
