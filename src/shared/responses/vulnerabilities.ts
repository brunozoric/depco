import { z } from "zod";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";

export const vulnerabilitySchema = z.object({
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

export const projectVulnerabilitySummarySchema = z.object({
    projectId: z.string(),
    projectName: z.string(),
    total: z.number(),
    critical: z.number(),
    high: z.number(),
    moderate: z.number(),
    low: z.number()
});

export const listVulnerabilitiesResponseSchema = z.object({
    items: z.array(vulnerabilitySchema),
    total: z.number()
});

export const getVulnerabilitySummaryResponseSchema = z.object({
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
});

export const scanVulnerabilitiesResponseSchema = z.object({
    total: z.number(),
    counts: z.object({
        critical: z.number(),
        high: z.number(),
        moderate: z.number(),
        low: z.number(),
        info: z.number()
    })
});

export const refreshOsvCacheResponseSchema = z.object({ invalidated: z.number() });

export const bulkVulnerabilitiesResponseSchema = z.object({ updatedCount: z.number() });

export const bulkRescanVulnerabilitiesResponseSchema = z.object({ projectsQueued: z.number() });

export const exportVulnerabilitiesResponseSchema = z.any();

export const getExpiredSnoozesResponseSchema = z.object({
    count: z.number(),
    packageNames: z.array(z.string())
});

export const osvReferenceSchema = z.object({
    type: z.string(),
    url: z.string()
});

export const osvAffectedVersionSchema = z.object({
    introduced: z.string().nullable(),
    fixed: z.string().nullable(),
    lastAffected: z.string().nullable()
});

export const osvEnrichedDetailSchema = z.object({
    description: z.string().nullable(),
    references: z.array(osvReferenceSchema),
    affectedVersions: z.array(osvAffectedVersionSchema),
    cvssScore: z.number().nullable(),
    cvssVector: z.string().nullable(),
    aliases: z.array(z.string())
});

export const getVulnerabilityDetailResponseSchema = z.object({
    vulnerability: vulnerabilitySchema.extend({ dedupKey: z.string() }),
    osvDetail: osvEnrichedDetailSchema.nullable()
});
