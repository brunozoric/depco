import { z } from "zod";

export const securityStatusSchema = z.object({
    passes: z.boolean(),
    checks: z.record(z.string(), z.boolean())
});

export const projectTeamBadgeSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string()
});

export const projectSchema = z.object({
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

export const dependencySchema = z.object({
    name: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string().nullable(),
    latestInRange: z.string().nullable(),
    type: z.string(),
    upgradeType: z.string().nullable(),
    dependencyKind: z.string(),
    registryResolved: z.boolean()
});

export const createProjectResponseSchema = z.object({ item: projectSchema });

export const listProjectsResponseSchema = z.object({
    items: z.array(projectSchema),
    total: z.number()
});

export const getProjectResponseSchema = z.object({ item: projectSchema });

export const scanProjectAsyncResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});

export const getProjectDependenciesResponseSchema = z.object({
    items: z.array(dependencySchema),
    total: z.number()
});

export const getTransitiveResolveStatusResponseSchema = z.object({
    total: z.number(),
    resolved: z.number(),
    pending: z.number()
});

export const getProjectSecurityResponseSchema = z.object({ item: securityStatusSchema });

export const checkProjectSecurityResponseSchema = z.object({ item: securityStatusSchema });

export const exportProjectSchema = z.object({ path: z.string() });

export const exportProjectsResponseSchema = z.object({
    items: z.array(exportProjectSchema)
});

export const importResultSchema = z.object({
    path: z.string(),
    status: z.enum(["added", "skipped", "failed"]),
    error: z.string().optional()
});

export const importProjectsResponseSchema = z.object({
    items: z.array(importResultSchema)
});

export const projectTeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string()
});

export const getProjectTeamsResponseSchema = z.object({
    items: z.array(projectTeamSchema),
    total: z.number()
});

export const cloneProjectResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});

export const bulkScanProjectsResponseSchema = z.object({
    enqueuedCount: z.number(),
    skippedCount: z.number()
});
