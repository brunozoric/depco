import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const jobSchema = z.object({
    id: z.string(),
    referenceId: z.string(),
    referenceType: z.string(),
    type: z.string(),
    status: z.string(),
    packages: z.string().nullable(),
    logs: z.string().nullable(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    warning: z.string().nullable().optional(),
    progress: z.number().nullable(),
    progressLabel: z.string().nullable(),
    parentJobId: z.string().nullable().optional()
});

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
    response: z.object({ item: z.object({ jobId: z.string() }) })
});

export const listJobsRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/jobs",
    description: "List all jobs for a project",
    params: z.object({ id: z.string() }),
    response: z.object({ items: z.array(jobSchema), total: z.number() })
});

export const getJobRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/jobs/:jobId",
    description: "Get a single job's status and logs",
    params: z.object({ id: z.string(), jobId: z.string() }),
    response: z.object({ item: jobSchema })
});

export const createTransientJobRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/jobs/transient",
    description: "Enqueue a standalone transient dependency refresh job",
    params: z.object({ id: z.string() }),
    response: z.object({ item: z.object({ jobId: z.string() }) })
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
    response: z.object({ items: z.array(jobSchema), total: z.number() })
});

export const cancelJobRoute = defineRoute({
    method: "POST",
    path: "/api/jobs/:jobId/cancel",
    description: "Cancel or kill a job",
    params: z.object({ jobId: z.string() }),
    response: z.object({ success: z.boolean() })
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
    response: z.object({ deleted: z.number() })
});
