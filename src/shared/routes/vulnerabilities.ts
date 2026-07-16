import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";

const vulnerabilitySchema = z.object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    packageName: z.string(),
    severity: z.enum(VULNERABILITY_SEVERITIES),
    title: z.string(),
    advisoryUrl: z.string().nullable(),
    cveId: z.string().nullable(),
    vulnerableRange: z.string().nullable(),
    fixVersion: z.string().nullable(),
    source: z.enum(["audit", "osv", "both"]),
    installedVersion: z.string().nullable(),
    dependencyKind: z.string(),
    scannedAt: z.number(),
    dismissedAt: z.number().nullable(),
    dismissedUntil: z.number().nullable(),
    dismissedBy: z.string().nullable()
});

const projectVulnerabilitySummarySchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    total: z.number(),
    critical: z.number(),
    high: z.number(),
    moderate: z.number(),
    low: z.number()
});

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
    response: z.object({
        items: z.array(vulnerabilitySchema),
        total: z.number()
    })
});

export const getVulnerabilitySummaryRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/summary",
    description: "Get vulnerability summary for dashboard",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        totalVulnerabilities: z.number(),
        counts: z.object({
            critical: z.number(),
            high: z.number(),
            moderate: z.number(),
            low: z.number(),
            info: z.number()
        }),
        transitiveCount: z.number(),
        directCount: z.number(),
        projectSummaries: z.array(projectVulnerabilitySummarySchema)
    })
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
    response: z.object({
        items: z.array(vulnerabilitySchema),
        total: z.number()
    })
});

export const scanVulnerabilitiesRoute = defineRoute({
    method: "POST",
    path: "/api/vulnerabilities/:projectId/scan",
    description: "Trigger manual vulnerability re-scan for a project",
    params: z.object({ projectId: z.string() }),
    response: z.object({
        total: z.number(),
        counts: z.object({
            critical: z.number(),
            high: z.number(),
            moderate: z.number(),
            low: z.number(),
            info: z.number()
        })
    })
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
    response: z.object({ invalidated: z.number() })
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
    response: z.object({ updatedCount: z.number() })
});

export const bulkRescanVulnerabilitiesRoute = defineRoute({
    method: "POST",
    path: "/api/vulnerabilities/bulk/rescan",
    description: "Trigger rescan for projects of selected vulnerabilities",
    params: z.object({}),
    body: z.object({ ids: z.array(z.string()).min(1) }),
    response: z.object({ projectsQueued: z.number() })
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
    }),
    response: z.any()
});

const osvReferenceSchema = z.object({
    type: z.string(),
    url: z.string()
});

const osvAffectedVersionSchema = z.object({
    introduced: z.string().nullable(),
    fixed: z.string().nullable(),
    lastAffected: z.string().nullable()
});

const osvEnrichedDetailSchema = z.object({
    description: z.string().nullable(),
    references: z.array(osvReferenceSchema),
    affectedVersions: z.array(osvAffectedVersionSchema),
    cvssScore: z.number().nullable(),
    cvssVector: z.string().nullable(),
    aliases: z.array(z.string())
});

export const getExpiredSnoozesRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/expired-snoozes",
    description: "Get recently expired snoozed vulnerabilities",
    params: z.object({}),
    querystring: z.object({
        since: z.coerce.number()
    }),
    response: z.object({
        count: z.number(),
        packageNames: z.array(z.string())
    })
});

export const getVulnerabilityDetailRoute = defineRoute({
    method: "GET",
    path: "/api/vulnerabilities/:vulnerabilityId/detail",
    description: "Get full vulnerability detail with OSV enrichment",
    params: z.object({ vulnerabilityId: z.string() }),
    response: z.object({
        vulnerability: vulnerabilitySchema.extend({ dedupKey: z.string() }),
        osvDetail: osvEnrichedDetailSchema.nullable()
    })
});
