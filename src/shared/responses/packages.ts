import { z } from "zod";

export const packageProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string().nullable(),
    upgradeType: z.string().nullable()
});

export const packageListItemSchema = z.object({
    name: z.string(),
    projects: z.array(packageProjectSchema),
    resolvedChangelogCount: z.number(),
    totalChangelogCount: z.number(),
    lastPublishedAt: z.number().nullable(),
    dependencyKind: z.string(),
    registryResolved: z.boolean()
});

export const listPackagesResponseSchema = z.object({
    items: z.array(packageListItemSchema),
    total: z.number()
});

export const rescanPackageResponseSchema = z.object({
    item: z.object({ updated: z.number() })
});

export const packageDetailProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string(),
    upgradeType: z.string(),
    dependencyKind: z.string()
});

export const packageDetailSchema = z.object({
    name: z.string(),
    repoUrl: z.string().nullable(),
    projects: z.array(packageDetailProjectSchema),
    latestVersion: z.string().nullable(),
    lastPublishedAt: z.number().nullable(),
    registryResolved: z.boolean()
});

export const getPackageDetailResponseSchema = z.object({ item: packageDetailSchema });

export type ListPackagesResponse = z.infer<typeof listPackagesResponseSchema>;
export type RescanPackageResponse = z.infer<typeof rescanPackageResponseSchema>;
export type GetPackageDetailResponse = z.infer<typeof getPackageDetailResponseSchema>;
