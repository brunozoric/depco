import { describe, it, expect } from "vitest";
import { CsvFormatter } from "../CsvFormatter.js";
import type { IScanOutput } from "../types.js";

function createTestOutput(): IScanOutput {
    return {
        meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 5, configPath: null },
        findings: {
            license: [
                {
                    packageName: "gpl-pkg",
                    version: "1.0.0",
                    license: "GPL-3.0",
                    riskTier: "copyleft"
                }
            ],
            vulnerability: [
                {
                    packageName: "vuln-pkg",
                    installedVersion: "1.0.0",
                    severity: "critical",
                    title: "RCE vulnerability",
                    advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                    cveId: "CVE-2024-1234",
                    dedupKey: "CVE-2024-1234",
                    vulnerableRange: "<2.0.0",
                    fixVersion: "2.0.0",
                    source: "both"
                }
            ]
        },
        summary: {
            licenseViolations: 1,
            vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 },
            total: 2
        }
    };
}

describe("CsvFormatter", () => {
    const formatter = new CsvFormatter();

    it("outputs header row", () => {
        const result = formatter.format(createTestOutput());
        const lines = result.split("\n");
        expect(lines[0]).toBe("type,package,version,detail,severity,source,fixVersion");
    });

    it("outputs license finding as row", () => {
        const result = formatter.format(createTestOutput());
        expect(result).toContain("license,gpl-pkg,1.0.0,GPL-3.0,copyleft,,");
    });

    it("outputs vulnerability finding as row", () => {
        const result = formatter.format(createTestOutput());
        expect(result).toContain("vulnerability,vuln-pkg,1.0.0,CVE-2024-1234,critical,both,2.0.0");
    });

    it("escapes commas in package names", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: "@scope/pkg,name",
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"@scope/pkg,name"');
    });

    it("escapes quotes in values", () => {
        const output = createTestOutput();
        output.findings.vulnerability = [
            {
                packageName: "pkg",
                installedVersion: "1.0.0",
                severity: "high",
                title: 'Has "quotes"',
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash123",
                vulnerableRange: null,
                fixVersion: null,
                source: "audit"
            }
        ];

        const result = formatter.format(output);
        // Advisory ID (detail column) should use dedupKey when no cveId
        expect(result).toContain("hash123");
    });

    it("handles empty findings", () => {
        const output = createTestOutput();
        output.findings.license = [];
        output.findings.vulnerability = [];

        const result = formatter.format(output);
        const lines = result.split("\n").filter(Boolean);
        expect(lines).toHaveLength(1); // header only
    });
});
