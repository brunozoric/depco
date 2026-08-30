import { z } from "zod";

export const jobSchema = z.object({
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

export const jobHandleSchema = z.object({ jobId: z.string() });

export const jobHandleResponseSchema = z.object({ item: jobHandleSchema });

export const createUpgradeJobResponseSchema = jobHandleResponseSchema;

export const listJobsResponseSchema = z.object({
    items: z.array(jobSchema),
    total: z.number()
});

export const getJobResponseSchema = z.object({ item: jobSchema });

export const createTransientJobResponseSchema = jobHandleResponseSchema;

export const cancelJobResponseSchema = z.object({ success: z.boolean() });

export const deleteJobsResponseSchema = z.object({ deleted: z.number() });
