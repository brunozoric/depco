import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const engineStatusSchema = z.enum(["current", "active-lts", "maintenance", "eol", "unknown"]);

const engineStatusCountsSchema = z.object({
    eol: z.number(),
    maintenance: z.number(),
    activeLts: z.number(),
    current: z.number(),
    unknown: z.number()
});

const engineCheckSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    packageName: z.string(),
    enginesNode: z.string().nullable(),
    minimumMajor: z.number().nullable(),
    status: engineStatusSchema,
    eolDate: z.number().nullable(),
    scannedAt: z.number()
});

const projectEngineSummarySchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    rootStatus: engineStatusSchema,
    rootEnginesNode: z.string().nullable(),
    dependencyCounts: engineStatusCountsSchema
});

const engineSummarySchema = z.object({
    totalProjects: z.number(),
    counts: engineStatusCountsSchema,
    projectSummaries: z.array(projectEngineSummarySchema)
});

const nodeReleaseSchema = z.object({
    version: z.number(),
    codename: z.string().nullable(),
    releaseDate: z.number(),
    ltsStart: z.number().nullable(),
    maintenanceStart: z.number().nullable(),
    eolDate: z.number()
});

const engineScanResultSchema = z.object({
    rootStatus: engineStatusSchema,
    rootEnginesNode: z.string().nullable(),
    findings: z.array(engineCheckSchema),
    summary: engineSummarySchema
});

export const getEngineSummaryRoute = defineRoute({
    method: "GET",
    path: "/api/engines/summary",
    description: "Get aggregate engine status summary across projects",
    params: z.object({}),
    response: engineSummarySchema
});

export const listNodeReleasesRoute = defineRoute({
    method: "GET",
    path: "/api/engines/releases",
    description: "List the cached Node.js release schedule",
    params: z.object({}),
    response: z.object({ items: z.array(nodeReleaseSchema), total: z.number() })
});

export const getProjectEngineChecksRoute = defineRoute({
    method: "GET",
    path: "/api/engines/:projectId",
    description: "List engine checks for a specific project",
    params: z.object({ projectId: z.string() }),
    response: z.object({ items: z.array(engineCheckSchema), total: z.number() })
});

export const scanProjectEnginesRoute = defineRoute({
    method: "POST",
    path: "/api/engines/:projectId/scan",
    description: "Trigger an engine scan for a project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        warnMaintenance: z
            .enum(["true", "false"])
            .transform(value => value === "true")
            .optional()
    }),
    response: engineScanResultSchema
});
