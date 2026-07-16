import { AuditParserService as Abstraction } from "./abstractions/AuditParserService.js";
import {
    VULNERABILITY_SEVERITIES,
    type VulnerabilitySeverity
} from "#shared/vulnerabilities/types.js";

interface INpmAuditAdvisory {
    title: string;
    url?: string;
    severity: string;
    range?: string;
}

interface INpmAuditVulnerabilityEntry {
    name: string;
    severity: string;
    via: Array<INpmAuditAdvisory | string>;
    fixAvailable?: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

interface INpmAuditJson {
    vulnerabilities?: Record<string, INpmAuditVulnerabilityEntry>;
}

interface IYarnAuditLineChildren {
    ID: number;
    Issue: string;
    URL: string;
    Severity: string;
    "Vulnerable Versions": string;
}

interface IYarnAuditLine {
    value: string;
    children: IYarnAuditLineChildren;
}

interface IPnpmAdvisory {
    module_name: string;
    severity: string;
    title: string;
    url?: string;
    cves?: string[];
    vulnerable_versions?: string;
    patched_versions?: string;
}

interface IPnpmAuditJson {
    advisories?: Record<string, IPnpmAdvisory>;
}

function normalizeSeverity(value: string): VulnerabilitySeverity {
    const lowered = value.toLowerCase();
    return (VULNERABILITY_SEVERITIES as readonly string[]).includes(lowered)
        ? (lowered as VulnerabilitySeverity)
        : "info";
}

function extractFixVersion(
    fixAvailable: INpmAuditVulnerabilityEntry["fixAvailable"]
): string | null {
    if (fixAvailable && typeof fixAvailable === "object" && fixAvailable.version) {
        return fixAvailable.version;
    }
    return null;
}

class AuditParserServiceImpl implements Abstraction.Interface {
    public parse(jsonOutput: string, packageManager: string): Abstraction.Vulnerability[] {
        const trimmed = jsonOutput.trim();
        if (!trimmed) {
            return [];
        }

        switch (packageManager) {
            case "yarn":
                return this.parseYarnAudit(trimmed);
            case "pnpm":
                return this.parsePnpmAudit(trimmed);
            case "npm":
            case "bun":
                return this.parseNpmAudit(trimmed);
            default:
                return [];
        }
    }

    private parseNpmAudit(jsonOutput: string): Abstraction.Vulnerability[] {
        let parsed: INpmAuditJson;
        try {
            parsed = JSON.parse(jsonOutput) as INpmAuditJson;
        } catch {
            return [];
        }

        const vulnerabilities: Abstraction.Vulnerability[] = [];
        for (const entry of Object.values(parsed.vulnerabilities ?? {})) {
            const fixVersion = extractFixVersion(entry.fixAvailable);

            for (const via of entry.via) {
                if (typeof via === "string") {
                    continue;
                }

                vulnerabilities.push({
                    packageName: entry.name,
                    severity: normalizeSeverity(via.severity),
                    title: via.title,
                    advisoryUrl: via.url ?? null,
                    cveId: null,
                    vulnerableRange: via.range ?? null,
                    fixVersion
                });
            }
        }

        return vulnerabilities;
    }

    private parseYarnAudit(jsonOutput: string): Abstraction.Vulnerability[] {
        const vulnerabilities: Abstraction.Vulnerability[] = [];

        for (const line of jsonOutput.split("\n")) {
            if (!line.trim()) {
                continue;
            }

            let entry: IYarnAuditLine;
            try {
                entry = JSON.parse(line) as IYarnAuditLine;
            } catch {
                continue;
            }

            if (!entry.value || !entry.children) {
                continue;
            }

            vulnerabilities.push({
                packageName: entry.value,
                severity: normalizeSeverity(entry.children.Severity),
                title: entry.children.Issue,
                advisoryUrl: entry.children.URL ?? null,
                cveId: null,
                vulnerableRange: entry.children["Vulnerable Versions"] ?? null,
                fixVersion: null
            });
        }

        return vulnerabilities;
    }

    private parsePnpmAudit(jsonOutput: string): Abstraction.Vulnerability[] {
        let parsed: IPnpmAuditJson;
        try {
            parsed = JSON.parse(jsonOutput) as IPnpmAuditJson;
        } catch {
            return [];
        }

        const vulnerabilities: Abstraction.Vulnerability[] = [];
        for (const advisory of Object.values(parsed.advisories ?? {})) {
            vulnerabilities.push({
                packageName: advisory.module_name,
                severity: normalizeSeverity(advisory.severity),
                title: advisory.title,
                advisoryUrl: advisory.url ?? null,
                cveId: advisory.cves && advisory.cves.length > 0 ? advisory.cves[0]! : null,
                vulnerableRange: advisory.vulnerable_versions ?? null,
                fixVersion: advisory.patched_versions ?? null
            });
        }

        return vulnerabilities;
    }
}

export const AuditParserService = Abstraction.createImplementation({
    implementation: AuditParserServiceImpl,
    dependencies: []
});
