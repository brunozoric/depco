import { z } from "zod";

export const autoFixSettingsSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    enabled: z.boolean(),
    upgradeTypes: z.array(z.string()),
    groupingStrategy: z.string(),
    branchPrefix: z.string(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const autoFixPullRequestSchema = z.object({
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

export const getAutoFixSettingsResponseSchema = autoFixSettingsSchema;

export const updateAutoFixSettingsResponseSchema = autoFixSettingsSchema;

export const listAutoFixPullRequestsResponseSchema = z.object({
    items: z.array(autoFixPullRequestSchema),
    total: z.number()
});

export const getProjectAutoFixPullRequestsResponseSchema = z.object({
    items: z.array(autoFixPullRequestSchema),
    total: z.number()
});

export const generateAutoFixPrResponseSchema = z.object({
    jobId: z.string()
});

export const deleteAutoFixPullRequestResponseSchema = z.object({
    deleted: z.boolean()
});
