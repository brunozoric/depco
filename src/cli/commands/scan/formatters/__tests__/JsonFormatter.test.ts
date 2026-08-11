import { describe, it, expect } from "vitest";
import { JsonFormatter } from "../JsonFormatter.js";
import type { IScanOutput } from "../types.js";

describe("JsonFormatter", () => {
    const formatter = new JsonFormatter();

    it("outputs valid JSON matching IScanOutput shape", () => {
        const output: IScanOutput = {
            meta: {
                timestamp: "2026-08-10T00:00:00.000Z",
                packageCount: 5,
                configPath: "depco.config.ts"
            },
            findings: {
                license: [
                    {
                        packageName: "gpl-pkg",
                        version: "1.0.0",
                        license: "GPL-3.0",
                        riskTier: "copyleft"
                    }
                ],
                vulnerability: [],
                engines: [
                    {
                        packageName: "my-app",
                        version: "1.0.0",
                        enginesNode: ">=14",
                        minimumMajor: 14,
                        status: "eol",
                        eolDate: 1682812800000,
                        isRoot: true
                    }
                ]
            },
            summary: {
                licenseViolations: 1,
                vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                engines: { eol: 1, maintenance: 0, activeLts: 0, current: 0, unknown: 0 },
                total: 1
            }
        };

        const result = formatter.format(output);
        const parsed = JSON.parse(result);

        expect(parsed.meta.timestamp).toBe("2026-08-10T00:00:00.000Z");
        expect(parsed.meta.packageCount).toBe(5);
        expect(parsed.findings.license).toHaveLength(1);
        expect(parsed.findings.license[0].packageName).toBe("gpl-pkg");
        expect(parsed.findings.engines).toHaveLength(1);
        expect(parsed.findings.engines[0].packageName).toBe("my-app");
        expect(parsed.findings.engines[0].isRoot).toBe(true);
        expect(parsed.summary.engines.eol).toBe(1);
        expect(parsed.summary.total).toBe(1);
    });

    it("roundtrips: format then parse matches original", () => {
        const output: IScanOutput = {
            meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 0, configPath: null },
            findings: { license: [], vulnerability: [], engines: [] },
            summary: {
                licenseViolations: 0,
                vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                engines: { eol: 0, maintenance: 0, activeLts: 0, current: 0, unknown: 0 },
                total: 0
            }
        };

        const result = formatter.format(output);
        const parsed = JSON.parse(result);

        expect(parsed).toEqual(output);
    });

    it("outputs pretty-printed JSON with 2-space indent", () => {
        const output: IScanOutput = {
            meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 0, configPath: null },
            findings: { license: [], vulnerability: [], engines: [] },
            summary: {
                licenseViolations: 0,
                vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                engines: { eol: 0, maintenance: 0, activeLts: 0, current: 0, unknown: 0 },
                total: 0
            }
        };

        const result = formatter.format(output);
        expect(result).toContain("  "); // 2-space indent
        expect(result.split("\n").length).toBeGreaterThan(1);
    });
});
