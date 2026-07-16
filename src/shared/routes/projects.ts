import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const securityStatusSchema = z.object({
    passes: z.boolean(),
    checks: z.record(z.string(), z.boolean())
});

const projectTeamBadgeSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string()
});

const projectSchema = z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    packageManager: z.string().nullable(),
    pmVersion: z.string().nullable(),
    addedAt: z.number(),
    lastScannedAt: z.number().nullable(),
    security: securityStatusSchema.nullable().optional(),
    hasNodeModules: z.boolean(),
    teams: z.array(projectTeamBadgeSchema).optional()
});

const dependencySchema = z.object({
    name: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string().nullable(),
    latestInRange: z.string().nullable(),
    type: z.string(),
    upgradeType: z.string().nullable(),
    dependencyKind: z.string(),
    registryResolved: z.boolean()
});

export const createProjectRoute = defineRoute({
    method: "POST",
    path: "/api/projects",
    description: "Create a new project",
    params: z.object({}),
    body: z.object({ path: z.string().min(1) }),
    response: z.object({ item: projectSchema })
});

export const listProjectsRoute = defineRoute({
    method: "GET",
    path: "/api/projects",
    description: "List all projects",
    params: z.object({}),
    response: z.object({ items: z.array(projectSchema), total: z.number() })
});

export const getProjectRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id",
    description: "Get a single project",
    params: z.object({ id: z.string() }),
    response: z.object({ item: projectSchema })
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
    response: z.object({ item: z.object({ jobId: z.string() }) })
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
        registryResolved: z.enum(["all", "true", "false"]).optional()
    }),
    response: z.object({ items: z.array(dependencySchema), total: z.number() })
});

export const getTransitiveResolveStatusRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/transitive-resolve-status",
    description: "Get transitive dependency resolution status for a project",
    params: z.object({ id: z.string() }),
    response: z.object({
        total: z.number(),
        resolved: z.number(),
        pending: z.number()
    })
});

export const getProjectSecurityRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/security",
    description: "Get the latest persisted security status for a project",
    params: z.object({ id: z.string() }),
    response: z.object({ item: securityStatusSchema })
});

export const checkProjectSecurityRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/security",
    description: "Run a fresh security check for a project",
    params: z.object({ id: z.string() }),
    response: z.object({ item: securityStatusSchema })
});

const exportProjectSchema = z.object({ path: z.string() });

export const exportProjectsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/export",
    description: "Export all project paths as JSON",
    params: z.object({}),
    response: z.object({ items: z.array(exportProjectSchema) })
});

const importResultSchema = z.object({
    path: z.string(),
    status: z.enum(["added", "skipped", "failed"]),
    error: z.string().optional()
});

export const importProjectsRoute = defineRoute({
    method: "POST",
    path: "/api/projects/import",
    description: "Import projects from a list of paths",
    params: z.object({}),
    body: z.object({ items: z.array(exportProjectSchema) }),
    response: z.object({ items: z.array(importResultSchema) })
});

const projectTeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string()
});

export const getProjectTeamsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/teams",
    description: "Get teams for a project",
    params: z.object({ id: z.string() }),
    response: z.object({
        items: z.array(projectTeamSchema),
        total: z.number()
    })
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
    response: z.object({ item: z.object({ jobId: z.string() }) })
});
