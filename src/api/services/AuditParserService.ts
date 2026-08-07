import { z } from "zod";
import { AuditParserService as Abstraction } from "./abstractions/AuditParserService.js";
import {
    VULNERABILITY_SEVERITIES,
    type VulnerabilitySeverity
} from "#shared/vulnerabilities/types.js";

const npmAuditAdvisorySchema = z.object({
    title: z.string(),
    url: z.string().optional(),
    severity: z.string(),
    range: z.string().optional()
});

const npmAuditSchema = z.object({
    vulnerabilities: z
        .record(
            z.string(),
            z.object({
                name: z.string(),
                severity: z.string(),
                via: z.array(z.union([npmAuditAdvisorySchema, z.string()])),
                fixAvailable: z
                    .union([
                        z.boolean(),
                        z.object({
                            name: z.string(),
                            version: z.string(),
                            isSemVerMajor: z.boolean()
                        })
                    ])
                    .optional()
            })
        )
        .optional()
        .default({})
});

const yarnAuditLineSchema = z.object({
    value: z.string(),
    children: z.object({
        ID: z.number(),
        Issue: z.string(),
        URL: z.string(),
        Severity: z.string(),
        "Vulnerable Versions": z.string()
    })
});

const pnpmAuditSchema = z.object({
    advisories: z
        .record(
            z.string(),
            z.object({
                module_name: z.string(),
                severity: z.string(),
                title: z.string(),
                url: z.string().optional(),
                cves: z.array(z.string()).optional().default([]),
                vulnerable_versions: z.string().optional(),
                patched_versions: z.string().optional()
            })
        )
        .optional()
        .default({})
});

function normalizeSeverity(value: string): VulnerabilitySeverity {
    const lowered = value.toLowerCase();
    return (VULNERABILITY_SEVERITIES as readonly string[]).includes(lowered)
        ? (lowered as VulnerabilitySeverity)
        : "info";
}

function extractFixVersion(
    fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean } | undefined
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
        let parsed: z.infer<typeof npmAuditSchema>;
        try {
            parsed = npmAuditSchema.parse(JSON.parse(jsonOutput));
        } catch {
            return [];
        }

        const vulnerabilities: Abstraction.Vulnerability[] = [];
        for (const entry of Object.values(parsed.vulnerabilities)) {
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

            let json: unknown;
            try {
                json = JSON.parse(line);
            } catch {
                continue;
            }
            const parseResult = yarnAuditLineSchema.safeParse(json);
            if (!parseResult.success) {
                continue;
            }
            const entry = parseResult.data;

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
        let parsed: z.infer<typeof pnpmAuditSchema>;
        try {
            parsed = pnpmAuditSchema.parse(JSON.parse(jsonOutput));
        } catch {
            return [];
        }

        const vulnerabilities: Abstraction.Vulnerability[] = [];
        for (const advisory of Object.values(parsed.advisories)) {
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
