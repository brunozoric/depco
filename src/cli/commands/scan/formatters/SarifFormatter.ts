import type { LicenseRiskTier } from "#shared/licenses/types.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { EngineStatus } from "#shared/engines/types.js";
import type { IOutputFormatter, IScanOutput } from "./types.js";

const SARIF_SCHEMA_URL =
    "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json";
const SARIF_VERSION = "2.1.0";
const TOOL_NAME = "depco";
const TOOL_VERSION = "0.0.0";

type SarifLevel = "error" | "warning" | "note";

interface ISarifRule {
    id: string;
    shortDescription: { text: string };
    defaultConfiguration: { level: SarifLevel };
}

interface ISarifArtifactLocation {
    uri: string;
}

interface ISarifPhysicalLocation {
    artifactLocation: ISarifArtifactLocation;
}

interface ISarifLocation {
    physicalLocation: ISarifPhysicalLocation;
}

interface ISarifResult {
    ruleId: string;
    ruleIndex: number;
    message: { text: string };
    locations: ISarifLocation[];
    properties: Record<string, unknown>;
}

interface ISarifDriver {
    name: string;
    version: string;
    rules: ISarifRule[];
}

interface ISarifRun {
    tool: { driver: ISarifDriver };
    results: ISarifResult[];
}

interface ISarifLog {
    $schema: string;
    version: string;
    runs: ISarifRun[];
}

interface IAddRuleInput {
    rules: ISarifRule[];
    rule: ISarifRule;
}

function mapSeverityToLevel(severity: VulnerabilitySeverity): SarifLevel {
    switch (severity) {
        case "critical":
        case "high":
            return "error";
        case "moderate":
            return "warning";
        case "low":
        case "info":
            return "note";
    }
}

function mapEngineStatusToLevel(status: EngineStatus): SarifLevel {
    return status === "eol" ? "error" : "warning";
}

function mapRiskTierToLevel(riskTier: LicenseRiskTier): SarifLevel {
    switch (riskTier) {
        case "copyleft":
        case "proprietary":
            return "error";
        case "weak-copyleft":
            return "warning";
        case "permissive":
        case "unknown":
            return "note";
    }
}

function addRule(input: IAddRuleInput): number {
    const { rules, rule } = input;
    const existingIndex = rules.findIndex(existing => existing.id === rule.id);
    if (existingIndex >= 0) {
        return existingIndex;
    }
    rules.push(rule);
    return rules.length - 1;
}

export class SarifFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const rules: ISarifRule[] = [];
        const results: ISarifResult[] = [];

        for (const violation of output.findings.license) {
            const ruleId = `license/${violation.riskTier}/${violation.license}`;
            const ruleIndex = addRule({
                rules,
                rule: {
                    id: ruleId,
                    shortDescription: {
                        text: `License risk: ${violation.license} (${violation.riskTier})`
                    },
                    defaultConfiguration: { level: mapRiskTierToLevel(violation.riskTier) }
                }
            });

            results.push({
                ruleId,
                ruleIndex,
                message: {
                    text: `Package ${violation.packageName}@${violation.version} uses ${violation.license} license (${violation.riskTier} risk)`
                },
                locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
                properties: {
                    version: violation.version,
                    license: violation.license,
                    riskTier: violation.riskTier
                }
            });
        }

        for (const vulnerability of output.findings.vulnerability) {
            const ruleId = `vulnerability/${vulnerability.dedupKey}`;
            const ruleIndex = addRule({
                rules,
                rule: {
                    id: ruleId,
                    shortDescription: { text: vulnerability.title },
                    defaultConfiguration: { level: mapSeverityToLevel(vulnerability.severity) }
                }
            });

            results.push({
                ruleId,
                ruleIndex,
                message: {
                    text: `Package ${vulnerability.packageName}@${vulnerability.installedVersion} has ${vulnerability.severity} vulnerability ${vulnerability.cveId ?? vulnerability.dedupKey}`
                },
                locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
                properties: {
                    installedVersion: vulnerability.installedVersion,
                    fixVersion: vulnerability.fixVersion,
                    source: vulnerability.source,
                    dedupKey: vulnerability.dedupKey
                }
            });
        }

        for (const finding of output.findings.engines) {
            if (finding.status !== "eol" && finding.status !== "maintenance") {
                continue;
            }

            const ruleId = `engines/${finding.status}`;
            const ruleIndex = addRule({
                rules,
                rule: {
                    id: ruleId,
                    shortDescription: {
                        text: `Node.js ${finding.status} engine requirement`
                    },
                    defaultConfiguration: { level: mapEngineStatusToLevel(finding.status) }
                }
            });

            results.push({
                ruleId,
                ruleIndex,
                message: {
                    text: `Package ${finding.packageName} requires Node.js ${finding.enginesNode ?? "unknown"} (${finding.status})`
                },
                locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
                properties: {
                    status: finding.status,
                    enginesNode: finding.enginesNode,
                    isRoot: finding.isRoot
                }
            });
        }

        const sarifLog: ISarifLog = {
            $schema: SARIF_SCHEMA_URL,
            version: SARIF_VERSION,
            runs: [
                {
                    tool: {
                        driver: {
                            name: TOOL_NAME,
                            version: TOOL_VERSION,
                            rules
                        }
                    },
                    results
                }
            ]
        };

        return JSON.stringify(sarifLog, null, 2);
    }
}
