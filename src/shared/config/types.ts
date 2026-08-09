import type { LicenseRiskTier } from "../licenses/types.js";
import type { VulnerabilitySeverity } from "../vulnerabilities/types.js";

export interface ILicenseScanConfig {
    allowedRiskTiers?: LicenseRiskTier[];
    ignoredPackages?: string[];
}

export interface IVulnerabilityScanConfig {
    maxSeverity?: VulnerabilitySeverity;
    ignoredPackages?: string[];
}

export interface IScanConfig {
    license?: ILicenseScanConfig;
    vulnerability?: IVulnerabilityScanConfig;
    ignoredPackages?: string[];
    registryUrl?: string;
}

export interface IDepcoConfig {
    scan?: IScanConfig;
}
