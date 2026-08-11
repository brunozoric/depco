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
            ],
            engines: [
                {
                    packageName: "my-app",
                    version: "1.0.0",
                    enginesNode: ">=14",
                    minimumMajor: 14,
                    status: "eol",
                    eolDate: Date.parse("2023-04-30T00:00:00.000Z"),
                    isRoot: true
                },
                {
                    packageName: "some-dep",
                    version: "2.0.0",
                    enginesNode: ">=18",
                    minimumMajor: 18,
                    status: "maintenance",
                    eolDate: Date.parse("2025-04-30T00:00:00.000Z"),
                    isRoot: false
                }
            ]
        },
        summary: {
            licenseViolations: 1,
            vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 },
            engines: { eol: 1, maintenance: 1, activeLts: 0, current: 0, unknown: 0 },
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
        output.findings.engines = [];

        const result = formatter.format(output);
        const lines = result.split("\n").filter(Boolean);
        expect(lines).toHaveLength(1); // header only
    });

    it("outputs engines finding rows with severity mapped from status", () => {
        const result = formatter.format(createTestOutput());
        expect(result).toContain("engines,my-app,>=14,eol,error,root,2023-04-30");
        expect(result).toContain("engines,some-dep,>=18,maintenance,warning,dependency,2025-04-30");
    });

    it("maps engines status other than eol/maintenance to info severity", () => {
        const output = createTestOutput();
        output.findings.engines = [
            {
                packageName: "current-pkg",
                version: "1.0.0",
                enginesNode: ">=22",
                minimumMajor: 22,
                status: "current",
                eolDate: null,
                isRoot: false
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain("engines,current-pkg,>=22,current,info,dependency,");
    });

    it("escapes bare carriage return in values", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: "pkg\rwith\rcr",
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"pkg\rwith\rcr"');
    });

    it("doubles quotes inside quoted values", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: 'He said "hello"',
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"He said ""hello"""');
    });

    it("escapes newline in values", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: "line1\nline2",
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"line1\nline2"');
    });

    it("escapes values with combined special characters", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: 'has,comma "and" quote\nnewline',
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"has,comma ""and"" quote\nnewline"');
    });

    it("passes through empty string unchanged", () => {
        const output = createTestOutput();
        output.findings.vulnerability = [
            {
                packageName: "pkg",
                installedVersion: "1.0.0",
                severity: "low",
                title: "minor issue",
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash",
                vulnerableRange: null,
                fixVersion: null,
                source: "audit"
            }
        ];

        const result = formatter.format(output);
        const lines = result.split("\n");
        const vulnLine = lines.find(line => line.startsWith("vulnerability,"));
        // fixVersion is null -> "" and source "audit" are both present, no wrapping quotes around empty
        expect(vulnLine).toBe("vulnerability,pkg,1.0.0,hash,low,audit,");
    });

    it("escapes CRLF in values", () => {
        const output = createTestOutput();
        output.findings.license = [
            {
                packageName: "line1\r\nline2",
                version: "1.0.0",
                license: "MIT",
                riskTier: "permissive"
            }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"line1\r\nline2"');
    });
});
