import { z } from "zod";
import { RISK_TIER_VALUES } from "../licenses/types.js";
import { VULNERABILITY_SEVERITIES } from "../vulnerabilities/types.js";

const licenseScanConfigSchema = z.object({
    allowedRiskTiers: z.array(z.enum(RISK_TIER_VALUES)).optional(),
    ignoredPackages: z.array(z.string()).optional()
});

const vulnerabilityScanConfigSchema = z.object({
    maxSeverity: z.enum(VULNERABILITY_SEVERITIES).optional(),
    ignoredPackages: z.array(z.string()).optional()
});

const enginesScanConfigSchema = z.object({
    ignore: z.array(z.string()).optional(),
    warnMaintenance: z.boolean().optional()
});

const scanConfigSchema = z.object({
    license: licenseScanConfigSchema.optional(),
    vulnerability: vulnerabilityScanConfigSchema.optional(),
    engines: enginesScanConfigSchema.optional(),
    ignoredPackages: z.array(z.string()).optional(),
    registryUrl: z.string().url().optional()
});

export const depcoConfigSchema = z.object({
    scan: scanConfigSchema.optional()
});
