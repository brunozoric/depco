import { z } from "zod";

export const directoryEntrySchema = z.object({
    name: z.string(),
    path: z.string(),
    type: z.literal("directory")
});

export const browseFilesystemResponseSchema = z.object({
    items: z.array(directoryEntrySchema),
    total: z.number(),
    currentPath: z.string()
});

export const scanItemSchema = z.object({
    name: z.string(),
    path: z.string()
});

export const scanFilesystemResponseSchema = z.object({
    items: z.array(scanItemSchema),
    total: z.number(),
    scannedPath: z.string(),
    scannedCount: z.number(),
    filteredCount: z.number(),
    mode: z.enum(["workspaces", "depth"])
});

export type BrowseFilesystemResponse = z.infer<typeof browseFilesystemResponseSchema>;
export type ScanFilesystemResponse = z.infer<typeof scanFilesystemResponseSchema>;
