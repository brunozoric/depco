import { z } from "zod";

export const engineStatusSchema = z.enum([
    "current",
    "active-lts",
    "maintenance",
    "eol",
    "unknown"
]);

export const engineStatusCountsSchema = z.object({
    eol: z.number(),
    maintenance: z.number(),
    activeLts: z.number(),
    current: z.number(),
    unknown: z.number()
});

export const engineCheckSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    packageName: z.string(),
    enginesNode: z.string().nullable(),
    minimumMajor: z.number().nullable(),
    status: engineStatusSchema,
    eolDate: z.number().nullable(),
    scannedAt: z.number()
});

export const projectEngineSummarySchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    rootStatus: engineStatusSchema,
    rootEnginesNode: z.string().nullable(),
    dependencyCounts: engineStatusCountsSchema,
    lastScannedAt: z.number().nullable(),
    engineScanStale: z.boolean(),
    engineScanStaleReason: z.enum(["time", "release", "both"]).nullable()
});

export const engineSummarySchema = z.object({
    totalProjects: z.number(),
    counts: engineStatusCountsSchema,
    projectSummaries: z.array(projectEngineSummarySchema),
    staleProjectCount: z.number(),
    stalenessThresholdMs: z.number()
});

export const nodeReleaseSchema = z.object({
    version: z.number(),
    codename: z.string().nullable(),
    releaseDate: z.number(),
    ltsStart: z.number().nullable(),
    maintenanceStart: z.number().nullable(),
    eolDate: z.number()
});

export const engineScanResultSchema = z.object({
    rootStatus: engineStatusSchema,
    rootEnginesNode: z.string().nullable(),
    findings: z.array(engineCheckSchema),
    summary: engineSummarySchema
});

export const listNodeReleasesResponseSchema = z.object({
    items: z.array(nodeReleaseSchema),
    total: z.number()
});

export const getProjectEngineChecksResponseSchema = z.object({
    items: z.array(engineCheckSchema),
    total: z.number()
});

export const getProjectEngineStalenessResponseSchema = z.object({
    lastScannedAt: z.number().nullable(),
    engineScanStale: z.boolean(),
    engineScanStaleReason: z.enum(["time", "release", "both"]).nullable(),
    stalenessThresholdMs: z.number()
});

export const bulkScanEnginesResponseSchema = z.object({ scannedCount: z.number() });
