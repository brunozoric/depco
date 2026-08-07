import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export interface IAuditVulnerability {
    packageName: string;
    severity: VulnerabilitySeverity;
    title: string;
    advisoryUrl: string | null;
    cveId: string | null;
    vulnerableRange: string | null;
    fixVersion: string | null;
}

export interface IAuditParserService {
    parse(jsonOutput: string, packageManager: string): IAuditVulnerability[];
}

export const AuditParserService = createAbstraction<IAuditParserService>("Api/AuditParserService");

export namespace AuditParserService {
    export type Interface = IAuditParserService;
    export type Vulnerability = IAuditVulnerability;
}
