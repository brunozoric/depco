import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    createUpgradeJobResponseSchema,
    listJobsResponseSchema,
    getJobResponseSchema,
    createTransientJobResponseSchema,
    cancelJobResponseSchema,
    deleteJobsResponseSchema
} from "../responses/jobs.js";

const upgradePackageInputSchema = z.object({
    name: z.string(),
    targetVersion: z.string()
});

export const createUpgradeJobRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/jobs/upgrade",
    description: "Enqueue a dependency upgrade job",
    params: z.object({ id: z.string() }),
    body: z.object({
        packages: z.array(upgradePackageInputSchema),
        refreshTransient: z.boolean().optional()
    }),
    response: createUpgradeJobResponseSchema
});

export const listJobsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/jobs",
    description: "List all jobs for a project",
    params: z.object({ id: z.string() }),
    response: listJobsResponseSchema
});

export const getJobRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/jobs/:jobId",
    description: "Get a single job's status and logs",
    params: z.object({ id: z.string(), jobId: z.string() }),
    response: getJobResponseSchema
});

export const createTransientJobRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/jobs/transient",
    description: "Enqueue a standalone transient dependency refresh job",
    params: z.object({ id: z.string() }),
    response: createTransientJobResponseSchema
});

export const listAllJobsRoute = defineRoute({
    method: "GET",
    path: "/api/jobs",
    description: "List all jobs across all projects",
    params: z.object({}),
    querystring: z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        referenceId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.string().optional(),
        offset: z.string().optional()
    }),
    response: listJobsResponseSchema
});

export const cancelJobRoute = defineRoute({
    method: "POST",
    path: "/api/jobs/:jobId/cancel",
    description: "Cancel or kill a job",
    params: z.object({ jobId: z.string() }),
    response: cancelJobResponseSchema
});

export const deleteJobsRoute = defineRoute({
    method: "DELETE",
    path: "/api/jobs",
    description: "Bulk delete jobs matching filters",
    params: z.object({}),
    body: z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        referenceId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional()
    }),
    response: deleteJobsResponseSchema
});
