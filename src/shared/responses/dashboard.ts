import { z } from "zod";

export const healthProjectSchema = z.object({
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

export const worstProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    score: z.number(),
    totalPackages: z.number(),
    upToDate: z.number(),
    patchOutdated: z.number(),
    minorOutdated: z.number(),
    majorOutdated: z.number()
});

export const healthSummarySchema = z.object({
    totalProjects: z.number(),
    averageScore: z.number(),
    worstProject: worstProjectSchema.nullable()
});

export const dashboardHealthResponseSchema = z.object({
    summary: healthSummarySchema,
    projects: z.array(healthProjectSchema)
});

export const trendSnapshotSchema = z.object({
    date: z.string(),
    score: z.number()
});

export const trendProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    snapshots: z.array(trendSnapshotSchema)
});

export const dashboardTrendResponseSchema = z.object({
    items: z.array(trendProjectSchema)
});

export const activityJobSchema = z.object({
    id: z.string(),
    type: z.string(),
    referenceId: z.string(),
    referenceType: z.string(),
    status: z.string(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable()
});

export const dashboardActivityResponseSchema = z.object({
    items: z.array(activityJobSchema)
});

export const stalenessProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    lastScannedAt: z.number().nullable()
});

export const dashboardStalenessResponseSchema = z.object({
    items: z.array(stalenessProjectSchema)
});

export const securityProjectSchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    totalChecks: z.number(),
    passingChecks: z.number()
});

export const dashboardSecurityResponseSchema = z.object({
    items: z.array(securityProjectSchema)
});

export const dashboardVulnerabilityTrendResponseSchema = z.object({
    points: z.array(
        z.object({
            date: z.string(),
            critical: z.number(),
            high: z.number(),
            moderate: z.number(),
            low: z.number()
        })
    )
});

export const dashboardStalenessTrendResponseSchema = z.object({
    points: z.array(
        z.object({
            date: z.string(),
            patchOutdated: z.number(),
            minorOutdated: z.number(),
            majorOutdated: z.number(),
            totalPackages: z.number()
        })
    )
});

export const dashboardLicenseTrendResponseSchema = z.object({
    points: z.array(
        z.object({
            date: z.string(),
            compliantCount: z.number(),
            deniedCount: z.number(),
            warnedCount: z.number(),
            totalPackages: z.number()
        })
    )
});

export const dashboardAutoFixTrendResponseSchema = z.object({
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
});

export const dashboardDependencyChangesResponseSchema = z.object({
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
});

export const scoreDetailOutdatedPackageSchema = z.object({
    name: z.string(),
    currentVersion: z.string(),
    latestVersion: z.string(),
    upgradeType: z.enum(["major", "minor", "patch"])
});

export const scoreDetailVulnerabilitySchema = z.object({
    packageName: z.string(),
    severity: z.enum(["critical", "high", "moderate", "low"]),
    title: z.string(),
    fixVersion: z.string().nullable(),
    penalty: z.number()
});

export const dashboardScoreDetailResponseSchema = z.object({
    outdatedPackages: z.array(scoreDetailOutdatedPackageSchema),
    vulnerabilities: z.array(scoreDetailVulnerabilitySchema)
});
