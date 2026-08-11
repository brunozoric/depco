import { describe, it, expect } from "vitest";
import { SarifFormatter } from "../SarifFormatter.js";
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
            engines: []
        },
        summary: {
            licenseViolations: 1,
            vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 },
            engines: { eol: 0, maintenance: 0, activeLts: 0, current: 0, unknown: 0 },
            total: 2
        }
    };
}

describe("SarifFormatter", () => {
    const formatter = new SarifFormatter();

    it("outputs valid JSON with SARIF 2.1.0 schema", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);

        expect(sarif.version).toBe("2.1.0");
        expect(sarif.$schema).toContain("sarif-schema-2.1.0");
        expect(sarif.runs).toHaveLength(1);
    });

    it("populates tool driver info", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const driver = sarif.runs[0].tool.driver;

        expect(driver.name).toBe("depco");
        expect(driver.version).toBeDefined();
    });

    it("creates rules for each unique finding type", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        expect(rules).toHaveLength(2);

        const licenseRule = rules.find((r: { id: string }) => r.id.startsWith("license/"));
        expect(licenseRule.id).toBe("license/copyleft/GPL-3.0");

        const vulnRule = rules.find((r: { id: string }) => r.id.startsWith("vulnerability/"));
        expect(vulnRule.id).toBe("vulnerability/CVE-2024-1234");
    });

    it("maps severity to SARIF level correctly", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        const vulnRule = rules.find((r: { id: string }) => r.id.startsWith("vulnerability/"));
        expect(vulnRule.defaultConfiguration.level).toBe("error"); // critical → error
    });

    it("creates results referencing rules by ruleId and ruleIndex", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const results = sarif.runs[0].results;

        expect(results).toHaveLength(2);

        for (const sarifResult of results) {
            expect(sarifResult.ruleId).toBeDefined();
            expect(sarifResult.ruleIndex).toBeGreaterThanOrEqual(0);
            expect(sarifResult.message.text).toBeTruthy();
        }
    });

    it("includes properties bag with type-specific metadata", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const results = sarif.runs[0].results;

        const licenseResult = results.find((r: { ruleId: string }) =>
            r.ruleId.startsWith("license/")
        );
        expect(licenseResult.properties.version).toBe("1.0.0");
        expect(licenseResult.properties.license).toBe("GPL-3.0");
        expect(licenseResult.properties.riskTier).toBe("copyleft");

        const vulnResult = results.find((r: { ruleId: string }) =>
            r.ruleId.startsWith("vulnerability/")
        );
        expect(vulnResult.properties.installedVersion).toBe("1.0.0");
        expect(vulnResult.properties.fixVersion).toBe("2.0.0");
        expect(vulnResult.properties.source).toBe("both");
        expect(vulnResult.properties.dedupKey).toBe("CVE-2024-1234");
    });

    it("maps severity levels correctly", () => {
        const output = createTestOutput();
        output.findings.vulnerability = [
            {
                packageName: "a",
                installedVersion: "1.0.0",
                severity: "critical",
                title: "t",
                advisoryUrl: null,
                cveId: "CVE-1",
                dedupKey: "CVE-1",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            },
            {
                packageName: "b",
                installedVersion: "1.0.0",
                severity: "high",
                title: "t",
                advisoryUrl: null,
                cveId: "CVE-2",
                dedupKey: "CVE-2",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            },
            {
                packageName: "c",
                installedVersion: "1.0.0",
                severity: "moderate",
                title: "t",
                advisoryUrl: null,
                cveId: "CVE-3",
                dedupKey: "CVE-3",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            },
            {
                packageName: "d",
                installedVersion: "1.0.0",
                severity: "low",
                title: "t",
                advisoryUrl: null,
                cveId: "CVE-4",
                dedupKey: "CVE-4",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            },
            {
                packageName: "e",
                installedVersion: "1.0.0",
                severity: "info",
                title: "t",
                advisoryUrl: null,
                cveId: "CVE-5",
                dedupKey: "CVE-5",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            }
        ];
        output.findings.license = [];

        const result = formatter.format(output);
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        const levels = rules.map(
            (r: { defaultConfiguration: { level: string } }) => r.defaultConfiguration.level
        );
        expect(levels).toEqual(["error", "error", "warning", "note", "note"]);
    });

    it("handles empty findings", () => {
        const output = createTestOutput();
        output.findings.license = [];
        output.findings.vulnerability = [];

        const result = formatter.format(output);
        const sarif = JSON.parse(result);

        expect(sarif.runs[0].tool.driver.rules).toEqual([]);
        expect(sarif.runs[0].results).toEqual([]);
    });

    describe("engines findings", () => {
        function createEnginesOutput() {
            const output = createTestOutput();
            output.findings.license = [];
            output.findings.vulnerability = [];
            output.findings.engines = [
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
                },
                {
                    packageName: "current-dep",
                    version: "3.0.0",
                    enginesNode: ">=22",
                    minimumMajor: 22,
                    status: "current",
                    eolDate: null,
                    isRoot: false
                }
            ];
            return output;
        }

        it("creates engines/eol and engines/maintenance rules, skipping current/unknown", () => {
            const result = formatter.format(createEnginesOutput());
            const sarif = JSON.parse(result);
            const rules = sarif.runs[0].tool.driver.rules;

            expect(rules).toHaveLength(2);
            expect(rules.map((r: { id: string }) => r.id).sort()).toEqual([
                "engines/eol",
                "engines/maintenance"
            ]);
        });

        it("maps eol to error level and maintenance to warning level", () => {
            const result = formatter.format(createEnginesOutput());
            const sarif = JSON.parse(result);
            const rules = sarif.runs[0].tool.driver.rules;

            const eolRule = rules.find((r: { id: string }) => r.id === "engines/eol");
            const maintenanceRule = rules.find(
                (r: { id: string }) => r.id === "engines/maintenance"
            );
            expect(eolRule.defaultConfiguration.level).toBe("error");
            expect(maintenanceRule.defaultConfiguration.level).toBe("warning");
        });

        it("creates results only for eol/maintenance findings, with isRoot in properties", () => {
            const result = formatter.format(createEnginesOutput());
            const sarif = JSON.parse(result);
            const results = sarif.runs[0].results;

            expect(results).toHaveLength(2);
            const eolResult = results.find((r: { ruleId: string }) => r.ruleId === "engines/eol");
            expect(eolResult.properties.isRoot).toBe(true);
            expect(eolResult.properties.enginesNode).toBe(">=14");
            expect(eolResult.message.text).toContain("my-app");
        });
    });
});
