import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const changelogEntrySchema = z.object({
    version: z.string(),
    content: z.string().nullable(),
    source: z.string().nullable()
});

const changelogResponseSchema = z.object({
    items: z.array(changelogEntrySchema),
    total: z.number(),
    resolving: z.boolean()
});

export const getChangelogsRoute = defineRoute({
    method: "GET",
    path: "/api/changelogs/:packageName",
    description: "Get changelogs for a package between two versions",
    params: z.object({ packageName: z.string() }),
    querystring: z.object({
        from: z.string(),
        to: z.string()
    }),
    response: changelogResponseSchema
});

export const reResolveChangelogsRoute = defineRoute({
    method: "POST",
    path: "/api/changelogs/:packageName/re-resolve",
    description: "Reset failed changelogs and re-resolve",
    params: z.object({ packageName: z.string() }),
    body: z.object({
        from: z.string(),
        to: z.string()
    }),
    response: changelogResponseSchema
});
