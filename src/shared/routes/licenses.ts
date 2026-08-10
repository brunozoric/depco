import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { RISK_TIER_VALUES, LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";

const licenseSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    packageName: z.string(),
    licenseName: z.string(),
    spdxId: z.string().nullable(),
    source: z.enum(["registry", "license-checker"]),
    riskTier: z.enum(RISK_TIER_VALUES),
    licenseUrl: z.string().nullable(),
    scannedAt: z.number()
});

const policyRuleSchema = z.object({
    id: z.string(),
    action: z.enum(LICENSE_POLICY_ACTIONS),
    licensePattern: z.string().nullable(),
    packagePattern: z.string().nullable(),
    projectId: z.string().nullable(),
    priority: z.number(),
    reason: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number()
});

const violationSchema = z.object({
    id: z.string(),
    licenseId: z.string(),
    ruleId: z.string(),
    projectId: z.string(),
    packageName: z.string(),
    action: z.enum(["warn", "deny"]),
    scannedAt: z.number()
});

export const listLicensesRoute = defineRoute({
    method: "GET",
    path: "/api/licenses",
    description: "List all licenses across projects",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional(),
        riskTier: z.string().optional(),
        spdxId: z.string().optional(),
        packageName: z.string().optional(),
        teamId: z.string().optional(),
        violationAction: z.enum(["warn", "deny"]).optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        sortBy: z.enum(["packageName", "licenseName", "riskTier", "projectName"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional()
    }),
    response: z.object({ items: z.array(licenseSchema), total: z.number() })
});

export const getLicenseSummaryRoute = defineRoute({
    method: "GET",
    path: "/api/licenses/summary",
    description: "Get license compliance summary",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional(),
        teamId: z.string().optional()
    }),
    response: z.object({
        totalPackages: z.number(),
        compliantPercent: z.number(),
        riskTierCounts: z.object({
            permissive: z.number(),
            "weak-copyleft": z.number(),
            copyleft: z.number(),
            proprietary: z.number(),
            unknown: z.number()
        }),
        violationCounts: z.object({
            warn: z.number(),
            deny: z.number()
        }),
        projectSummaries: z.array(
            z.object({
                projectId: z.string(),
                projectName: z.string(),
                total: z.number(),
                denied: z.number(),
                warned: z.number()
            })
        )
    })
});

export const getProjectLicensesRoute = defineRoute({
    method: "GET",
    path: "/api/licenses/:projectId",
    description: "List licenses for a specific project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        riskTier: z.string().optional(),
        packageName: z.string().optional(),
        teamId: z.string().optional()
    }),
    response: z.object({ items: z.array(licenseSchema), total: z.number() })
});

export const scanProjectLicensesRoute = defineRoute({
    method: "POST",
    path: "/api/licenses/:projectId/scan",
    description: "Trigger license scan for a project",
    params: z.object({ projectId: z.string() }),
    response: z.object({ jobId: z.string() })
});

export const listLicensePoliciesRoute = defineRoute({
    method: "GET",
    path: "/api/license-policies",
    description: "List all license policy rules",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional()
    }),
    response: z.object({ items: z.array(policyRuleSchema) })
});

export const createLicensePolicyRoute = defineRoute({
    method: "POST",
    path: "/api/license-policies",
    description: "Create a license policy rule",
    params: z.object({}),
    body: z.object({
        action: z.enum(LICENSE_POLICY_ACTIONS),
        licensePattern: z.string().nullable().optional(),
        packagePattern: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
        priority: z.number(),
        reason: z.string().nullable().optional()
    }),
    response: policyRuleSchema
});

export const updateLicensePolicyRoute = defineRoute({
    method: "PUT",
    path: "/api/license-policies/:id",
    description: "Update a license policy rule",
    params: z.object({ id: z.string() }),
    body: z.object({
        action: z.enum(LICENSE_POLICY_ACTIONS).optional(),
        licensePattern: z.string().nullable().optional(),
        packagePattern: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
        priority: z.number().optional(),
        reason: z.string().nullable().optional()
    }),
    response: policyRuleSchema
});

export const deleteLicensePolicyRoute = defineRoute({
    method: "DELETE",
    path: "/api/license-policies/:id",
    description: "Delete a license policy rule",
    params: z.object({ id: z.string() }),
    response: z.object({ deleted: z.boolean() })
});

export const listLicenseViolationsRoute = defineRoute({
    method: "GET",
    path: "/api/license-violations",
    description: "List license violations",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional(),
        action: z.string().optional(),
        packageName: z.string().optional(),
        teamId: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(200).optional()
    }),
    response: z.object({ items: z.array(violationSchema), total: z.number() })
});

export const getLicenseViolationsSummaryRoute = defineRoute({
    method: "GET",
    path: "/api/license-violations/summary",
    description: "Get license violations summary",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: z.object({
        total: z.number(),
        warnCount: z.number(),
        denyCount: z.number(),
        byProject: z.array(
            z.object({
                projectId: z.string(),
                projectName: z.string(),
                warnCount: z.number(),
                denyCount: z.number()
            })
        )
    })
});
