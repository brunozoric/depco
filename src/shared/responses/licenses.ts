import { z } from "zod";
import { RISK_TIER_VALUES, LICENSE_POLICY_ACTIONS } from "#shared/licenses/types.js";

export const licenseSchema = z.object({
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

export const policyRuleSchema = z.object({
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

export const violationSchema = z.object({
    id: z.string(),
    licenseId: z.string(),
    ruleId: z.string(),
    projectId: z.string(),
    packageName: z.string(),
    action: z.string(),
    scannedAt: z.number()
});

export const listLicensesResponseSchema = z.object({
    items: z.array(licenseSchema),
    total: z.number()
});

export const getLicenseSummaryResponseSchema = z.object({
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
});

export const scanProjectLicensesResponseSchema = z.object({ jobId: z.string() });

export const listLicensePoliciesResponseSchema = z.object({
    items: z.array(policyRuleSchema)
});

export const deleteLicensePolicyResponseSchema = z.object({ deleted: z.boolean() });

export const listLicenseViolationsResponseSchema = z.object({
    items: z.array(violationSchema),
    total: z.number()
});

export const getLicenseViolationsSummaryResponseSchema = z.object({
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
});

export type ListLicensesResponse = z.infer<typeof listLicensesResponseSchema>;
export type GetLicenseSummaryResponse = z.infer<typeof getLicenseSummaryResponseSchema>;
export type ScanProjectLicensesResponse = z.infer<typeof scanProjectLicensesResponseSchema>;
export type PolicyRuleResponse = z.infer<typeof policyRuleSchema>;
export type ListLicensePoliciesResponse = z.infer<typeof listLicensePoliciesResponseSchema>;
export type DeleteLicensePolicyResponse = z.infer<typeof deleteLicensePolicyResponseSchema>;
export type ListLicenseViolationsResponse = z.infer<typeof listLicenseViolationsResponseSchema>;
export type GetLicenseViolationsSummaryResponse = z.infer<
    typeof getLicenseViolationsSummaryResponseSchema
>;
