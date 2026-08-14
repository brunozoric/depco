import { z } from "zod";

export const edgeSchema = z.object({
    parentPackage: z.string().nullable(),
    parentVersion: z.string().nullable(),
    childPackage: z.string(),
    childVersion: z.string(),
    dependencyType: z.string(),
    depth: z.number()
});

export const pathNodeSchema = z.object({
    packageName: z.string(),
    version: z.string()
});

export const pathSchema = z.object({
    target: z.string(),
    chain: z.array(pathNodeSchema)
});

export const getDependencyGraphResponseSchema = z.union([
    z.object({
        edges: z.array(edgeSchema),
        rootPackages: z.array(z.string()),
        totalPackages: z.number(),
        maxDepth: z.number(),
        edgeCount: z.number()
    }),
    z.object({
        paths: z.array(pathSchema)
    })
]);

export const refreshDependencyGraphResponseSchema = z.object({ edgeCount: z.number() });

export const getDependencyGraphStatsResponseSchema = z.object({
    totalPackages: z.number(),
    maxDepth: z.number(),
    rootCount: z.number(),
    edgeCount: z.number()
});

export const searchDependencyPackagesResponseSchema = z.object({
    packages: z.array(z.string())
});

export type GetDependencyGraphResponse = z.infer<typeof getDependencyGraphResponseSchema>;
export type RefreshDependencyGraphResponse = z.infer<typeof refreshDependencyGraphResponseSchema>;
export type GetDependencyGraphStatsResponse = z.infer<typeof getDependencyGraphStatsResponseSchema>;
export type SearchDependencyPackagesResponse = z.infer<
    typeof searchDependencyPackagesResponseSchema
>;
