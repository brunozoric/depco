import type { LicenseRiskTier } from "#shared/licenses/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export interface ILicenseViolation {
    packageName: string;
    version: string;
    license: string;
    riskTier: LicenseRiskTier;
}

export interface IScanFindings {
    license: ILicenseViolation[];
    vulnerability: IMergedVulnerability[];
}

export interface IScanMeta {
    timestamp: string;
    packageCount: number;
    configPath: string | null;
}

export interface IScanSummary {
    licenseViolations: number;
    vulnerabilities: Record<VulnerabilitySeverity, number>;
    total: number;
}

export interface IScanOutput {
    meta: IScanMeta;
    findings: IScanFindings;
    summary: IScanSummary;
}

export interface IOutputFormatter {
    format(output: IScanOutput): string;
}
