import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const directoryEntrySchema = z.object({
    name: z.string(),
    path: z.string(),
    type: z.literal("directory")
});

export const browseFilesystemRoute = defineRoute({
    method: "GET",
    path: "/api/filesystem/browse",
    description: "Browse directories at a given path",
    params: z.object({}),
    querystring: z.object({
        path: z.string().optional(),
        showHidden: z.string().optional()
    }),
    response: z.object({
        items: z.array(directoryEntrySchema),
        total: z.number(),
        currentPath: z.string()
    })
});

const scanItemSchema = z.object({
    name: z.string(),
    path: z.string()
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
    response: z.object({
        items: z.array(scanItemSchema),
        total: z.number(),
        scannedPath: z.string(),
        scannedCount: z.number(),
        filteredCount: z.number(),
        mode: z.enum(["workspaces", "depth"])
    })
});
