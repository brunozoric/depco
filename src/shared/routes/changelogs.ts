import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    getChangelogsResponseSchema,
    reResolveAllChangelogsResponseSchema,
    changelogStatsSchema
} from "../responses/changelogs.js";

export const getChangelogsRoute = defineRoute({
    method: "GET",
    path: "/api/changelogs/:packageName",
    description: "Get changelogs for a package between two versions",
    params: z.object({ packageName: z.string() }),
    querystring: z.object({
        from: z.string(),
        to: z.string()
    }),
    response: getChangelogsResponseSchema
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
    response: getChangelogsResponseSchema
});

export const reResolveAllChangelogsRoute = defineRoute({
    method: "POST",
    path: "/api/changelogs/re-resolve-all",
    description: "Reset all failed changelogs across all packages and re-resolve",
    params: z.object({}),
    response: reResolveAllChangelogsResponseSchema
});

export const getChangelogStatsRoute = defineRoute({
    method: "GET",
    path: "/api/changelogs/stats",
    description: "Get changelog resolution statistics",
    params: z.object({}),
    response: changelogStatsSchema
});
