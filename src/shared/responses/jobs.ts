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

export const createUpgradeJobResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});

export const listJobsResponseSchema = z.object({
    items: z.array(jobSchema),
    total: z.number()
});

export const getJobResponseSchema = z.object({ item: jobSchema });

export const createTransientJobResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});

export const cancelJobResponseSchema = z.object({ success: z.boolean() });

export const deleteJobsResponseSchema = z.object({ deleted: z.number() });

export type CreateUpgradeJobResponse = z.infer<typeof createUpgradeJobResponseSchema>;
export type ListJobsResponse = z.infer<typeof listJobsResponseSchema>;
export type GetJobResponse = z.infer<typeof getJobResponseSchema>;
export type CreateTransientJobResponse = z.infer<typeof createTransientJobResponseSchema>;
export type CancelJobResponse = z.infer<typeof cancelJobResponseSchema>;
export type DeleteJobsResponse = z.infer<typeof deleteJobsResponseSchema>;
