import { describe, it, expect } from "vitest";
import { TableFormatter } from "../TableFormatter.js";
import type { IScanOutput } from "../types.js";

function createEmptyOutput(): IScanOutput {
    return {
        meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 10, configPath: null },
        findings: { license: [], vulnerability: [] },
        summary: {
            licenseViolations: 0,
            vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
            total: 0
        }
    };
}

describe("TableFormatter", () => {
    const formatter = new TableFormatter();

    it("renders empty output with no-issues message", () => {
        const result = formatter.format(createEmptyOutput());
        expect(result).toContain("No issues found");
    });

    it("renders license violations table", () => {
        const output = createEmptyOutput();
        output.findings.license = [
            { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "copyleft" }
        ];
        output.summary.licenseViolations = 1;
        output.summary.total = 1;

        const result = formatter.format(output);
        expect(result).toContain("gpl-pkg");
        expect(result).toContain("GPL-3.0");
        expect(result).toContain("copyleft");
        expect(result).toContain("1 license violation");
    });

    it("renders vulnerability table sorted by severity descending", () => {
        const output = createEmptyOutput();
        output.findings.vulnerability = [
            {
                packageName: "bar",
                installedVersion: "1.0.0",
                severity: "low",
                title: "Minor issue",
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash1",
                vulnerableRange: "<2.0.0",
                fixVersion: "2.0.0",
                source: "osv"
            },
            {
                packageName: "foo",
                installedVersion: "2.0.0",
                severity: "critical",
                title: "Critical issue",
                advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                cveId: "CVE-2024-1234",
                dedupKey: "CVE-2024-1234",
                vulnerableRange: "<3.0.0",
                fixVersion: "3.0.0",
                source: "audit"
            }
        ];
        output.summary.vulnerabilities.critical = 1;
        output.summary.vulnerabilities.low = 1;
        output.summary.total = 2;

        const result = formatter.format(output);
        const criticalIndex = result.indexOf("critical");
        const lowIndex = result.indexOf("low");
        expect(criticalIndex).toBeLessThan(lowIndex);
    });

    it("renders both tables when both have findings", () => {
        const output = createEmptyOutput();
        output.findings.license = [
            { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "copyleft" }
        ];
        output.findings.vulnerability = [
            {
                packageName: "vuln-pkg",
                installedVersion: "1.0.0",
                severity: "high",
                title: "XSS",
                advisoryUrl: null,
                cveId: "CVE-2024-5678",
                dedupKey: "CVE-2024-5678",
                vulnerableRange: "<2.0.0",
                fixVersion: "2.0.0",
                source: "audit"
            }
        ];
        output.summary.licenseViolations = 1;
        output.summary.vulnerabilities.high = 1;
        output.summary.total = 2;

        const result = formatter.format(output);
        expect(result).toContain("License");
        expect(result).toContain("Vulnerabilit");
    });
});
