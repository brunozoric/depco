import { z } from "zod";
import { defineRoute, paginationQuerySchema } from "#shared/routing/index.js";
import {
    getAutoFixSettingsResponseSchema,
    updateAutoFixSettingsResponseSchema,
    listAutoFixPullRequestsResponseSchema,
    getProjectAutoFixPullRequestsResponseSchema,
    generateAutoFixPrResponseSchema,
    deleteAutoFixPullRequestResponseSchema
} from "../responses/autoFix.js";

export const getAutoFixSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/auto-fix/:projectId/settings",
    description: "Get auto-fix settings for a project, falling back to defaults when unset",
    params: z.object({ projectId: z.string() }),
    response: getAutoFixSettingsResponseSchema
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
    response: updateAutoFixSettingsResponseSchema
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
        ...paginationQuerySchema
    }),
    response: listAutoFixPullRequestsResponseSchema
});

export const getProjectAutoFixPullRequestsRoute = defineRoute({
    method: "GET",
    path: "/api/auto-fix/:projectId/pull-requests",
    description: "List auto-fix pull request records for a specific project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        status: z.string().optional()
    }),
    response: getProjectAutoFixPullRequestsResponseSchema
});

export const generateAutoFixPrRoute = defineRoute({
    method: "POST",
    path: "/api/auto-fix/:projectId/generate",
    description: "Trigger auto-fix pull request generation for a project",
    params: z.object({ projectId: z.string() }),
    response: generateAutoFixPrResponseSchema
});

export const deleteAutoFixPullRequestRoute = defineRoute({
    method: "DELETE",
    path: "/api/auto-fix/pull-requests/:id",
    description: "Delete an auto-fix pull request record",
    params: z.object({ id: z.string() }),
    response: deleteAutoFixPullRequestResponseSchema
});
