import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const edgeSchema = z.object({
    parentPackage: z.string().nullable(),
    parentVersion: z.string().nullable(),
    childPackage: z.string(),
    childVersion: z.string(),
    dependencyType: z.string(),
    depth: z.number()
});

const pathNodeSchema = z.object({
    packageName: z.string(),
    version: z.string()
});

const pathSchema = z.object({
    target: z.string(),
    chain: z.array(pathNodeSchema)
});

export const getDependencyGraphRoute = defineRoute({
    method: "GET",
    path: "/api/dependency-graph/:projectId",
    description: "Get dependency graph or paths to a specific package",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        package: z.string().optional()
    }),
    response: z.union([
        z.object({
            edges: z.array(edgeSchema),
            rootPackages: z.array(z.string()),
            totalPackages: z.number(),
            maxDepth: z.number(),
            edgeCount: z.number()
        }),
        z.object({
            paths: z.array(pathSchema)
        })
    ])
});

export const refreshDependencyGraphRoute = defineRoute({
    method: "POST",
    path: "/api/dependency-graph/:projectId/refresh",
    description: "Trigger lockfile re-parse without full scan",
    params: z.object({ projectId: z.string() }),
    response: z.object({ edgeCount: z.number() })
});

export const getDependencyGraphStatsRoute = defineRoute({
    method: "GET",
    path: "/api/dependency-graph/:projectId/stats",
    description: "Get dependency graph summary stats",
    params: z.object({ projectId: z.string() }),
    response: z.object({
        totalPackages: z.number(),
        maxDepth: z.number(),
        rootCount: z.number(),
        edgeCount: z.number()
    })
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
    response: z.object({
        packages: z.array(z.string())
    })
});
