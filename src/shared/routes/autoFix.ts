import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const autoFixSettingsSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    enabled: z.boolean(),
    upgradeTypes: z.array(z.string()),
    groupingStrategy: z.string(),
    branchPrefix: z.string(),
    createdAt: z.number(),
    updatedAt: z.number()
});

const autoFixPullRequestSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    packageNames: z.array(z.string()),
    fromVersions: z.record(z.string(), z.string()),
    toVersions: z.record(z.string(), z.string()),
    upgradeType: z.string(),
    branchName: z.string(),
    prUrl: z.string().nullable(),
    prNumber: z.number().nullable(),
    status: z.string(),
    licenseWarnings: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const getAutoFixSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/auto-fix/:projectId/settings",
    description: "Get auto-fix settings for a project, falling back to defaults when unset",
    params: z.object({ projectId: z.string() }),
    response: autoFixSettingsSchema
});

export const updateAutoFixSettingsRoute = defineRoute({
    method: "PUT",
    path: "/api/auto-fix/:projectId/settings",
    description: "Create or update auto-fix settings for a project",
    params: z.object({ projectId: z.string() }),
    body: z.object({
        enabled: z.boolean().optional(),
        upgradeTypes: z.array(z.string()).optional(),
        groupingStrategy: z.string().optional(),
        branchPrefix: z.string().optional()
    }),
    response: autoFixSettingsSchema
});

export const listAutoFixPullRequestsRoute = defineRoute({
    method: "GET",
    path: "/api/auto-fix/pull-requests",
    description: "List auto-fix pull request records across all projects",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional(),
        status: z.string().optional(),
        teamId: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(200).optional()
    }),
    response: z.object({ items: z.array(autoFixPullRequestSchema), total: z.number() })
});

export const getProjectAutoFixPullRequestsRoute = defineRoute({
    method: "GET",
    path: "/api/auto-fix/:projectId/pull-requests",
    description: "List auto-fix pull request records for a specific project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        status: z.string().optional()
    }),
    response: z.object({ items: z.array(autoFixPullRequestSchema), total: z.number() })
});

export const generateAutoFixPrRoute = defineRoute({
    method: "POST",
    path: "/api/auto-fix/:projectId/generate",
    description: "Trigger auto-fix pull request generation for a project",
    params: z.object({ projectId: z.string() }),
    response: z.object({ jobId: z.string() })
});

export const deleteAutoFixPullRequestRoute = defineRoute({
    method: "DELETE",
    path: "/api/auto-fix/pull-requests/:id",
    description: "Delete an auto-fix pull request record",
    params: z.object({ id: z.string() }),
    response: z.object({ deleted: z.boolean() })
});
