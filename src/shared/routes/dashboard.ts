import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const healthProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    score: z.number(),
    scoreDelta: z.number().nullable(),
    totalPackages: z.number(),
    upToDate: z.number(),
    patchOutdated: z.number(),
    minorOutdated: z.number(),
    majorOutdated: z.number(),
    lastScannedAt: z.number().nullable(),
    vulnerabilityCritical: z.number(),
    vulnerabilityHigh: z.number(),
    vulnerabilityModerate: z.number(),
    vulnerabilityLow: z.number()
});

const worstProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    score: z.number(),
    totalPackages: z.number(),
    upToDate: z.number(),
    patchOutdated: z.number(),
    minorOutdated: z.number(),
    majorOutdated: z.number()
});

const healthSummarySchema = z.object({
    totalProjects: z.number(),
    averageScore: z.number(),
    worstProject: worstProjectSchema.nullable()
});

export const dashboardHealthRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/health",
    description: "Get current health snapshot per project",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        summary: healthSummarySchema,
        projects: z.array(healthProjectSchema)
    })
});

const trendSnapshotSchema = z.object({
    date: z.string(),
    score: z.number()
});

const trendProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    snapshots: z.array(trendSnapshotSchema)
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
    response: z.object({
        items: z.array(trendProjectSchema)
    })
});

const activityJobSchema = z.object({
    id: z.string(),
    type: z.string(),
    referenceId: z.string(),
    referenceType: z.string(),
    status: z.string(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable()
});

export const dashboardActivityRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/activity",
    description: "Get recent jobs across all projects",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        items: z.array(activityJobSchema)
    })
});

const stalenessProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    lastScannedAt: z.number().nullable()
});

export const dashboardStalenessRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/staleness",
    description: "Get projects sorted by scan freshness",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        items: z.array(stalenessProjectSchema)
    })
});

const securityProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    totalChecks: z.number(),
    passingChecks: z.number()
});

export const dashboardSecurityRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/security",
    description: "Get aggregate security check results per project",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        items: z.array(securityProjectSchema)
    })
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
    response: z.object({
        points: z.array(
            z.object({
                date: z.string(),
                critical: z.number(),
                high: z.number(),
                moderate: z.number(),
                low: z.number()
            })
        )
    })
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
    response: z.object({
        points: z.array(
            z.object({
                date: z.string(),
                patchOutdated: z.number(),
                minorOutdated: z.number(),
                majorOutdated: z.number(),
                totalPackages: z.number()
            })
        )
    })
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
    response: z.object({
        points: z.array(
            z.object({
                date: z.string(),
                compliantCount: z.number(),
                deniedCount: z.number(),
                warnedCount: z.number(),
                totalPackages: z.number()
            })
        )
    })
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
    response: z.object({
        points: z.array(
            z.object({
                date: z.string(),
                pending: z.number(),
                created: z.number(),
                merged: z.number(),
                closed: z.number(),
                failed: z.number()
            })
        )
    })
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
    response: z.object({
        items: z.array(
            z.object({
                id: z.string(),
                projectId: z.string(),
                projectName: z.string(),
                packageName: z.string(),
                changeType: z.enum(["added", "removed", "version-changed"]),
                previousVersion: z.string().nullable(),
                newVersion: z.string().nullable(),
                detectedAt: z.number()
            })
        ),
        total: z.number()
    })
});

const scoreDetailOutdatedPackageSchema = z.object({
    name: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string(),
    upgradeType: z.enum(["major", "minor", "patch"])
});

const scoreDetailVulnerabilitySchema = z.object({
    packageName: z.string(),
    severity: z.enum(["critical", "high", "moderate", "low"]),
    title: z.string(),
    fixVersion: z.string().nullable(),
    penalty: z.number()
});

export const dashboardScoreDetailRoute = defineRoute({
    method: "GET",
    path: "/api/dashboard/health/:projectId/score-detail",
    description: "Get score breakdown detail for a single project",
    params: z.object({
        projectId: z.string()
    }),
    querystring: z.object({}),
    response: z.object({
        outdatedPackages: z.array(scoreDetailOutdatedPackageSchema),
        vulnerabilities: z.array(scoreDetailVulnerabilitySchema)
    })
});
