import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listVulnerabilitiesResponseSchema,
    getVulnerabilitySummaryResponseSchema,
    scanVulnerabilitiesResponseSchema,
    refreshOsvCacheResponseSchema,
    bulkVulnerabilitiesResponseSchema,
    bulkRescanVulnerabilitiesResponseSchema,
    getExpiredSnoozesResponseSchema,
    getVulnerabilityDetailResponseSchema
} from "../responses/vulnerabilities.js";

export const listVulnerabilitiesRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities",
    description: "List all vulnerabilities across projects",
    params: z.object({}),
    querystring: z.object({
        severity: z.string().optional(),
        packageName: z.string().optional(),
        source: z.string().optional(),
        projectIds: z.string().optional(),
        includeDismissed: z.enum(["true", "false"]).optional(),
        scannedDate: z.string().date().optional(),
        teamId: z.string().optional(),
        dependencyType: z.enum(["all", "direct", "transitive"]).optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        sortBy: z.enum(["severity", "packageName", "projectName"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional()
    }),
    response: listVulnerabilitiesResponseSchema
});

export const getVulnerabilitySummaryRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/summary",
    description: "Get vulnerability summary for dashboard",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: getVulnerabilitySummaryResponseSchema
});

export const getProjectVulnerabilitiesRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/:projectId",
    description: "List vulnerabilities for a specific project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        severity: z.string().optional(),
        packageName: z.string().optional(),
        source: z.string().optional(),
        projectIds: z.string().optional(),
        includeDismissed: z.enum(["true", "false"]).optional(),
        scannedDate: z.string().date().optional(),
        dependencyType: z.enum(["all", "direct", "transitive"]).optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        sortBy: z.enum(["severity", "packageName", "projectName"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional()
    }),
    response: listVulnerabilitiesResponseSchema
});

export const scanVulnerabilitiesRoute = defineRoute({
    method: "POST",
    path: "/api/vulnerabilities/:projectId/scan",
    description: "Trigger manual vulnerability re-scan for a project",
    params: z.object({ projectId: z.string() }),
    response: scanVulnerabilitiesResponseSchema
});

export const refreshOsvCacheRoute = defineRoute({
    method: "POST",
    path: "/api/vulnerabilities/osv/refresh",
    description: "Force OSV cache refresh with filter options",
    params: z.object({}),
    body: z.object({
        packageName: z.string().optional(),
        packageNames: z.array(z.string()).optional(),
        all: z.boolean().optional(),
        olderThanMs: z.number().optional(),
        newerThanMs: z.number().optional()
    }),
    response: refreshOsvCacheResponseSchema
});

export const bulkVulnerabilitiesRoute = defineRoute({
    method: "PATCH",
    path: "/api/vulnerabilities/bulk",
    description: "Bulk dismiss, snooze, or undismiss vulnerabilities",
    params: z.object({}),
    body: z.discriminatedUnion("action", [
        z.object({ action: z.literal("dismiss"), ids: z.array(z.string()).min(1) }),
        z.object({
            action: z.literal("snooze"),
            ids: z.array(z.string()).min(1),
            snoozeDays: z.union([z.literal(7), z.literal(30), z.literal(90)])
        }),
        z.object({
            action: z.literal("undismiss"),
            ids: z.array(z.string()).min(1)
        })
    ]),
    response: bulkVulnerabilitiesResponseSchema
});

export const bulkRescanVulnerabilitiesRoute = defineRoute({
    method: "POST",
    path: "/api/vulnerabilities/bulk/rescan",
    description: "Trigger rescan for projects of selected vulnerabilities",
    params: z.object({}),
    body: z.object({ ids: z.array(z.string()).min(1) }),
    response: bulkRescanVulnerabilitiesResponseSchema
});

export const exportVulnerabilitiesRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/export",
    description: "Export vulnerabilities as CSV or JSON",
    params: z.object({}),
    querystring: z.object({
        format: z.enum(["csv", "json"]),
        severity: z.string().optional(),
        packageName: z.string().optional(),
        source: z.string().optional(),
        projectIds: z.string().optional(),
        includeDismissed: z.enum(["true", "false"]).optional(),
        ids: z.string().optional(),
        scannedDate: z.string().date().optional(),
        teamId: z.string().optional(),
        dependencyType: z.enum(["all", "direct", "transitive"]).optional(),
        sortBy: z.enum(["severity", "packageName", "projectName"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional()
    })
});

export const getExpiredSnoozesRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/expired-snoozes",
    description: "Get recently expired snoozed vulnerabilities",
    params: z.object({}),
    querystring: z.object({
        since: z.coerce.number()
    }),
    response: getExpiredSnoozesResponseSchema
});

export const getVulnerabilityDetailRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/:vulnerabilityId/detail",
    description: "Get full vulnerability detail with OSV enrichment",
    params: z.object({ vulnerabilityId: z.string() }),
    response: getVulnerabilityDetailResponseSchema
});
