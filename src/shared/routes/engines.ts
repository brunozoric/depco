import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    engineSummarySchema,
    engineScanResultSchema,
    listNodeReleasesResponseSchema,
    getProjectEngineChecksResponseSchema,
    getProjectEngineStalenessResponseSchema,
    bulkScanEnginesResponseSchema
} from "../responses/engines.js";

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
    response: listNodeReleasesResponseSchema
});

export const getProjectEngineChecksRoute = defineRoute({
    method: "GET",
    path: "/api/engines/:projectId",
    description: "List engine checks for a specific project",
    params: z.object({ projectId: z.string() }),
    response: getProjectEngineChecksResponseSchema
});

export const getProjectEngineStalenessRoute = defineRoute({
    method: "GET",
    path: "/api/engines/:projectId/staleness",
    description:
        "Get lightweight engine scan staleness info for a single project, without loading the all-projects summary",
    params: z.object({ projectId: z.string() }),
    response: getProjectEngineStalenessResponseSchema
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

export const bulkScanEnginesRoute = defineRoute({
    method: "POST",
    path: "/api/engines/bulk-scan",
    description: "Trigger an engine scan for multiple projects",
    params: z.object({}),
    body: z.object({ projectIds: z.array(z.string()).min(1) }),
    response: bulkScanEnginesResponseSchema
});
