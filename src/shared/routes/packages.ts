import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const packageProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string(),
    upgradeType: z.string()
});

const packageListItemSchema = z.object({
    name: z.string(),
    projects: z.array(packageProjectSchema),
    resolvedChangelogCount: z.number(),
    totalChangelogCount: z.number(),
    lastPublishedAt: z.number().nullable(),
    dependencyKind: z.string(),
    registryResolved: z.boolean()
});

export const listPackagesRoute = defineRoute({
    method: "GET",
    path: "/api/packages",
    description: "List all unique packages across projects with filters",
    params: z.object({}),
    querystring: z.object({
        search: z.string().optional(),
        upgradeType: z.enum(["patch", "minor", "major", "none"]).optional(),
        dependencyKind: z
            .enum([
                "all",
                "dependency",
                "devDependency",
                "peerDependency",
                "optionalDependency",
                "transitive"
            ])
            .optional(),
        projectId: z.string().optional(),
        hasChangelog: z.string().optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        sortBy: z.enum(["name", "lastPublishedAt"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        teamId: z.string().optional()
    }),
    response: z.object({
        items: z.array(packageListItemSchema),
        total: z.number()
    })
});

export const rescanPackageRoute = defineRoute({
    method: "POST",
    path: "/api/packages/:packageName/rescan",
    description: "Re-scan a single package from the registry",
    params: z.object({ packageName: z.string() }),
    querystring: z.object({}),
    response: z.object({
        item: z.object({ updated: z.number() })
    })
});
