import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    getDependencyGraphResponseSchema,
    refreshDependencyGraphResponseSchema,
    getDependencyGraphStatsResponseSchema,
    searchDependencyPackagesResponseSchema
} from "../responses/dependencyGraph.js";

export const getDependencyGraphRoute = defineRoute({
    method: "GET",
    path: "/api/dependency-graph/:projectId",
    description: "Get dependency graph or paths to a specific package",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        package: z.string().optional()
    }),
    response: getDependencyGraphResponseSchema
});

export const refreshDependencyGraphRoute = defineRoute({
    method: "POST",
    path: "/api/dependency-graph/:projectId/refresh",
    description: "Trigger lockfile re-parse without full scan",
    params: z.object({ projectId: z.string() }),
    response: refreshDependencyGraphResponseSchema
});

export const getDependencyGraphStatsRoute = defineRoute({
    method: "GET",
    path: "/api/dependency-graph/:projectId/stats",
    description: "Get dependency graph summary stats",
    params: z.object({ projectId: z.string() }),
    response: getDependencyGraphStatsResponseSchema
});

export const searchDependencyPackagesRoute = defineRoute({
    method: "GET",
    path: "/api/dependency-graph/:projectId/packages",
    description: "Search package names in dependency graph",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        query: z.string().default(""),
        limit: z.coerce.number().optional()
    }),
    response: searchDependencyPackagesResponseSchema
});
