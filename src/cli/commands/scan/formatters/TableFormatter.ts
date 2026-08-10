import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { LicenseRiskTier } from "#shared/licenses/types.js";
import type { ILicenseViolation, IOutputFormatter, IScanOutput } from "./types.js";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

const SEVERITY_COLORS: Record<VulnerabilitySeverity, string> = {
    critical: RED,
    high: YELLOW,
    moderate: CYAN,
    low: RESET,
    info: RESET
};

const RISK_TIER_COLORS: Record<LicenseRiskTier, string> = {
    permissive: RESET,
    "weak-copyleft": YELLOW,
    copyleft: RED,
    proprietary: RED,
    unknown: CYAN
};

interface IColorizeInput {
    text: string;
    color: string;
}

function colorize(input: IColorizeInput): string {
    const { text, color } = input;
    return `${color}${text}${RESET}`;
}

interface IPluralizeInput {
    count: number;
    singular: string;
    plural: string;
}

function pluralize(input: IPluralizeInput): string {
    const { count, singular, plural } = input;
    return `${count} ${count === 1 ? singular : plural}`;
}

export class TableFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const sections: string[] = [];

        if (output.findings.license.length > 0) {
            sections.push(this.renderLicenseTable(output.findings.license));
        }

        if (output.findings.vulnerability.length > 0) {
            sections.push(this.renderVulnerabilityTable(output.findings.vulnerability));
        }

        if (sections.length === 0) {
            return "No issues found";
        }

        return sections.join("\n\n");
    }

    private renderLicenseTable(violations: ILicenseViolation[]): string {
        const lines: string[] = [];

        const nameWidth = Math.max(7, ...violations.map(violation => violation.packageName.length));
        const versionWidth = Math.max(7, ...violations.map(violation => violation.version.length));
        const licenseWidth = Math.max(7, ...violations.map(violation => violation.license.length));
        const riskTierWidth = Math.max(
            9,
            ...violations.map(violation => violation.riskTier.length)
        );

        lines.push("License Violations");
        lines.push(
            `  ${"Package".padEnd(nameWidth)}  ${"Version".padEnd(versionWidth)}  ${"License".padEnd(licenseWidth)}  ${"Risk Tier".padEnd(riskTierWidth)}`
        );
        lines.push(
            `  ${"─".repeat(nameWidth)}  ${"─".repeat(versionWidth)}  ${"─".repeat(licenseWidth)}  ${"─".repeat(riskTierWidth)}`
        );

        for (const violation of violations) {
            const coloredRiskTier = colorize({
                text: violation.riskTier.padEnd(riskTierWidth),
                color: RISK_TIER_COLORS[violation.riskTier]
            });
            lines.push(
                `  ${violation.packageName.padEnd(nameWidth)}  ${violation.version.padEnd(versionWidth)}  ${violation.license.padEnd(licenseWidth)}  ${coloredRiskTier}`
            );
        }

        lines.push("");
        lines.push(
            pluralize({
                count: violations.length,
                singular: "license violation",
                plural: "license violations"
            })
        );

        return lines.join("\n");
    }

    private renderVulnerabilityTable(vulnerabilities: IMergedVulnerability[]): string {
        const sorted = [...vulnerabilities].sort(
            (left, right) =>
                VULNERABILITY_SEVERITIES.indexOf(left.severity) -
                VULNERABILITY_SEVERITIES.indexOf(right.severity)
        );

        const advisoryIdOf = (vulnerability: IMergedVulnerability): string =>
            vulnerability.cveId ?? vulnerability.advisoryUrl ?? "-";
        const fixVersionOf = (vulnerability: IMergedVulnerability): string =>
            vulnerability.fixVersion ?? "-";

        const nameWidth = Math.max(
            7,
            ...sorted.map(vulnerability => vulnerability.packageName.length)
        );
        const versionWidth = Math.max(
            16,
            ...sorted.map(vulnerability => vulnerability.installedVersion.length)
        );
        const severityWidth = Math.max(
            8,
            ...sorted.map(vulnerability => vulnerability.severity.length)
        );
        const advisoryWidth = Math.max(
            11,
            ...sorted.map(vulnerability => advisoryIdOf(vulnerability).length)
        );
        const fixVersionWidth = Math.max(
            11,
            ...sorted.map(vulnerability => fixVersionOf(vulnerability).length)
        );
        const sourceWidth = Math.max(
            6,
            ...sorted.map(vulnerability => vulnerability.source.length)
        );

        const lines: string[] = [];
        lines.push("Vulnerabilities");
        lines.push(
            `  ${"Package".padEnd(nameWidth)}  ${"Installed Version".padEnd(versionWidth)}  ${"Severity".padEnd(severityWidth)}  ${"Advisory ID".padEnd(advisoryWidth)}  ${"Fix Version".padEnd(fixVersionWidth)}  ${"Source".padEnd(sourceWidth)}`
        );
        lines.push(
            `  ${"─".repeat(nameWidth)}  ${"─".repeat(versionWidth)}  ${"─".repeat(severityWidth)}  ${"─".repeat(advisoryWidth)}  ${"─".repeat(fixVersionWidth)}  ${"─".repeat(sourceWidth)}`
        );

        for (const vulnerability of sorted) {
            const coloredSeverity = colorize({
                text: vulnerability.severity.padEnd(severityWidth),
                color: SEVERITY_COLORS[vulnerability.severity]
            });
            lines.push(
                `  ${vulnerability.packageName.padEnd(nameWidth)}  ${vulnerability.installedVersion.padEnd(versionWidth)}  ${coloredSeverity}  ${advisoryIdOf(vulnerability).padEnd(advisoryWidth)}  ${fixVersionOf(vulnerability).padEnd(fixVersionWidth)}  ${vulnerability.source.padEnd(sourceWidth)}`
            );
        }

        lines.push("");
        lines.push(
            pluralize({
                count: sorted.length,
                singular: "vulnerability",
                plural: "vulnerabilities"
            })
        );

        return lines.join("\n");
    }
}
