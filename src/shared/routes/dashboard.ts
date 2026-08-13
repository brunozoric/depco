import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    dashboardHealthResponseSchema,
    dashboardTrendResponseSchema,
    dashboardActivityResponseSchema,
    dashboardStalenessResponseSchema,
    dashboardSecurityResponseSchema,
    dashboardVulnerabilityTrendResponseSchema,
    dashboardStalenessTrendResponseSchema,
    dashboardLicenseTrendResponseSchema,
    dashboardAutoFixTrendResponseSchema,
    dashboardDependencyChangesResponseSchema,
    dashboardScoreDetailResponseSchema
} from "../responses/dashboard.js";

export const dashboardHealthRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/health",
    description: "Get current health snapshot per project",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: dashboardHealthResponseSchema
});

export const dashboardTrendRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/health/trend",
    description: "Get historical health snapshots for trend chart",
    params: z.object({}),
    querystring: z.object({
        range: z.enum(["7d", "30d", "90d", "all"]).optional(),
        teamId: z.string().optional()
    }),
    response: dashboardTrendResponseSchema
});

export const dashboardActivityRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/activity",
    description: "Get recent jobs across all projects",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: dashboardActivityResponseSchema
});

export const dashboardStalenessRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/staleness",
    description: "Get projects sorted by scan freshness",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: dashboardStalenessResponseSchema
});

export const dashboardSecurityRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/security",
    description: "Get aggregate security check results per project",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: dashboardSecurityResponseSchema
});

export const dashboardVulnerabilityTrendRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/vuln-trend",
    description: "Get historical vulnerability counts for trend chart",
    params: z.object({}),
    querystring: z.object({
        days: z.enum(["7", "30", "90"]).optional(),
        teamId: z.string().optional()
    }),
    response: dashboardVulnerabilityTrendResponseSchema
});

export const dashboardStalenessTrendRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/staleness-trend",
    description: "Get historical staleness counts for trend chart",
    params: z.object({}),
    querystring: z.object({
        days: z.enum(["7", "30", "90"]).optional(),
        teamId: z.string().optional()
    }),
    response: dashboardStalenessTrendResponseSchema
});

export const dashboardLicenseTrendRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/license-trend",
    description: "Get historical license compliance counts for trend chart",
    params: z.object({}),
    querystring: z.object({
        days: z.enum(["7", "30", "90"]).optional(),
        teamId: z.string().optional()
    }),
    response: dashboardLicenseTrendResponseSchema
});

export const dashboardAutoFixTrendRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/auto-fix-trend",
    description: "Get historical auto-fix PR counts by status",
    params: z.object({}),
    querystring: z.object({
        days: z.enum(["7", "30", "90"]).optional(),
        teamId: z.string().optional()
    }),
    response: dashboardAutoFixTrendResponseSchema
});

export const dashboardDependencyChangesRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/dependency-changes",
    description: "Get recent dependency changes across projects",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
        teamId: z.string().optional()
    }),
    response: dashboardDependencyChangesResponseSchema
});

export const dashboardScoreDetailRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/health/:projectId/score-detail",
    description: "Get score breakdown detail for a single project",
    params: z.object({
        projectId: z.string()
    }),
    querystring: z.object({}),
    response: dashboardScoreDetailResponseSchema
});
