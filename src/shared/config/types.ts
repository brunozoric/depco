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

export interface IEnginesScanConfig {
    ignore?: string[];
    warnMaintenance?: boolean;
}

export interface IScanConfig {
    license?: ILicenseScanConfig;
    vulnerability?: IVulnerabilityScanConfig;
    engines?: IEnginesScanConfig;
    ignoredPackages?: string[];
    registryUrl?: string;
}

export interface IDepcoConfig {
    scan?: IScanConfig;
}
