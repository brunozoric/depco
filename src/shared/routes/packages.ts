import { z } from "zod";
import { defineRoute, paginationQuerySchema, sortOrderSchema } from "#shared/routing/index.js";
import {
    listPackagesResponseSchema,
    rescanPackageResponseSchema,
    getPackageDetailResponseSchema
} from "../responses/packages.js";

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
        ...paginationQuerySchema,
        sortBy: z.enum(["name", "lastPublishedAt"]).optional(),
        ...sortOrderSchema,
        teamId: z.string().optional()
    }),
    response: listPackagesResponseSchema
});

export const rescanPackageRoute = defineRoute({
    method: "POST",
    path: "/api/packages/:packageName/rescan",
    description: "Re-scan a single package from the registry",
    params: z.object({ packageName: z.string() }),
    querystring: z.object({}),
    response: rescanPackageResponseSchema
});

export const getPackageDetailRoute = defineRoute({
    method: "GET",
    path: "/api/packages/:packageName",
    description: "Get detail for a single package across all projects",
    params: z.object({ packageName: z.string() }),
    response: getPackageDetailResponseSchema
});
