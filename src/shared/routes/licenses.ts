import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";
import {
    listLicensesResponseSchema,
    getLicenseSummaryResponseSchema,
    scanProjectLicensesResponseSchema,
    policyRuleSchema,
    listLicensePoliciesResponseSchema,
    deleteLicensePolicyResponseSchema,
    listLicenseViolationsResponseSchema,
    getLicenseViolationsSummaryResponseSchema
} from "../responses/licenses.js";

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
    response: listLicensesResponseSchema
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
    response: getLicenseSummaryResponseSchema
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
    response: listLicensesResponseSchema
});

export const scanProjectLicensesRoute = defineRoute({
    method: "POST",
    path: "/api/licenses/:projectId/scan",
    description: "Trigger license scan for a project",
    params: z.object({ projectId: z.string() }),
    response: scanProjectLicensesResponseSchema
});

export const listLicensePoliciesRoute = defineRoute({
    method: "GET",
    path: "/api/license-policies",
    description: "List all license policy rules",
    params: z.object({}),
    querystring: z.object({
        projectId: z.string().optional()
    }),
    response: listLicensePoliciesResponseSchema
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
    response: deleteLicensePolicyResponseSchema
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
    response: listLicenseViolationsResponseSchema
});

export const getLicenseViolationsSummaryRoute = defineRoute({
    method: "GET",
    path: "/api/license-violations/summary",
    description: "Get license violations summary",
    params: z.object({}),
    querystring: z.object({
        teamId: z.string().optional()
    }),
    response: getLicenseViolationsSummaryResponseSchema
});
