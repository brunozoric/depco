import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    createProjectResponseSchema,
    listProjectsResponseSchema,
    getProjectResponseSchema,
    scanProjectAsyncResponseSchema,
    getProjectDependenciesResponseSchema,
    getTransitiveResolveStatusResponseSchema,
    getProjectSecurityResponseSchema,
    checkProjectSecurityResponseSchema,
    exportProjectSchema,
    exportProjectsResponseSchema,
    importProjectsResponseSchema,
    getProjectTeamsResponseSchema,
    cloneProjectResponseSchema,
    bulkScanProjectsResponseSchema
} from "../responses/projects.js";

export const createProjectRoute = defineRoute({
    method: "POST",
    path: "/api/projects",
    description: "Create a new project",
    params: z.object({}),
    body: z.object({ path: z.string().min(1) }),
    response: createProjectResponseSchema
});

export const listProjectsRoute = defineRoute({
    method: "GET",
    path: "/api/projects",
    description: "List all projects",
    params: z.object({}),
    querystring: z.object({
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(200).optional()
    }),
    response: listProjectsResponseSchema
});

export const getProjectRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id",
    description: "Get a single project",
    params: z.object({ id: z.string() }),
    response: getProjectResponseSchema
});

export const deleteProjectRoute = defineRoute({
    method: "DELETE",
    path: "/api/projects/:id",
    description: "Delete a project",
    params: z.object({ id: z.string() })
});

export const scanProjectAsyncRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/scan",
    description: "Scan a project's dependencies asynchronously, returning a job id",
    params: z.object({ id: z.string() }),
    querystring: z.object({ force: z.string().optional() }),
    response: scanProjectAsyncResponseSchema
});

export const getProjectDependenciesRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/dependencies",
    description: "Get the cached dependencies for a project",
    params: z.object({ id: z.string() }),
    querystring: z.object({
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
        registryResolved: z.enum(["all", "true", "false"]).optional(),
        search: z.string().optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional()
    }),
    response: getProjectDependenciesResponseSchema
});

export const getTransitiveResolveStatusRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/transitive-resolve-status",
    description: "Get transitive dependency resolution status for a project",
    params: z.object({ id: z.string() }),
    response: getTransitiveResolveStatusResponseSchema
});

export const getProjectSecurityRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/security",
    description: "Get the latest persisted security status for a project",
    params: z.object({ id: z.string() }),
    response: getProjectSecurityResponseSchema
});

export const checkProjectSecurityRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/security",
    description: "Run a fresh security check for a project",
    params: z.object({ id: z.string() }),
    response: checkProjectSecurityResponseSchema
});

export const exportProjectsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/export",
    description: "Export all project paths as JSON",
    params: z.object({}),
    response: exportProjectsResponseSchema
});

export const importProjectsRoute = defineRoute({
    method: "POST",
    path: "/api/projects/import",
    description: "Import projects from a list of paths",
    params: z.object({}),
    body: z.object({ items: z.array(exportProjectSchema) }),
    response: importProjectsResponseSchema
});

export const getProjectTeamsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/teams",
    description: "Get teams for a project",
    params: z.object({ id: z.string() }),
    response: getProjectTeamsResponseSchema
});

export const setProjectTeamsRoute = defineRoute({
    method: "PUT",
    path: "/api/projects/:id/teams",
    description: "Set team assignments for a project",
    params: z.object({ id: z.string() }),
    body: z.object({ teamIds: z.array(z.string()) })
});

export const cloneProjectRoute = defineRoute({
    method: "POST",
    path: "/api/projects/clone",
    description: "Clone a GitHub repository and register as a project",
    params: z.object({}),
    body: z.object({
        url: z.string().min(1),
        destination: z.string().min(1),
        folderName: z.string().optional()
    }),
    response: cloneProjectResponseSchema
});

export const bulkScanProjectsRoute = defineRoute({
    method: "POST",
    path: "/api/projects/bulk-scan",
    description: "Enqueue scan jobs for multiple projects",
    params: z.object({}),
    body: z.object({
        projectIds: z.array(z.string()).min(1),
        force: z.boolean().optional()
    }),
    response: bulkScanProjectsResponseSchema
});
