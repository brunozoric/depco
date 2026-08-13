import { z } from "zod";

export const changelogEntrySchema = z.object({
    version: z.string(),
    content: z.string().nullable(),
    source: z.string().nullable()
});

export const getChangelogsResponseSchema = z.object({
    items: z.array(changelogEntrySchema),
    total: z.number(),
    resolving: z.boolean()
});

export const reResolveAllChangelogsResponseSchema = z.object({
    packageCount: z.number()
});

export const changelogStatsSchema = z.object({
    total: z.number(),
    resolved: z.number(),
    failed: z.number(),
    pending: z.number(),
    byResolver: z.record(z.string(), z.number())
});
