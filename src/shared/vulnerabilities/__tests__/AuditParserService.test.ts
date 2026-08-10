import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { AuditParserService } from "../abstractions/AuditParserService.js";
import { SharedVulnerabilityFeature } from "../feature.js";

describe("AuditParserService", () => {
    let parser: AuditParserService.Interface;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [SharedVulnerabilityFeature]);
        parser = container.resolve(AuditParserService);
    });

    describe("npm audit parsing", () => {
        it("parses npm audit JSON with advisory via entries", () => {
            const npmAuditOutput = JSON.stringify({
                vulnerabilities: {
                    lodash: {
                        name: "lodash",
                        severity: "high",
                        via: [
                            {
                                source: 1234,
                                name: "lodash",
                                title: "Prototype Pollution",
                                url: "https://github.com/advisories/GHSA-1234",
                                severity: "high",
                                range: "<4.17.21"
                            }
                        ],
                        fixAvailable: { name: "lodash", version: "4.17.21", isSemVerMajor: false }
                    }
                }
            });

            const results = parser.parse({
                jsonOutput: npmAuditOutput,
                packageManager: "npm"
            });

            expect(results).toHaveLength(1);
            expect(results[0]!.packageName).toBe("lodash");
            expect(results[0]!.severity).toBe("high");
            expect(results[0]!.title).toBe("Prototype Pollution");
            expect(results[0]!.fixVersion).toBe("4.17.21");
        });

        it("returns empty array for clean audit", () => {
            const results = parser.parse({
                jsonOutput: JSON.stringify({ vulnerabilities: {} }),
                packageManager: "npm"
            });
            expect(results).toEqual([]);
        });

        it("normalizes unknown severity to info", () => {
            const npmAuditOutput = JSON.stringify({
                vulnerabilities: {
                    foo: {
                        name: "foo",
                        severity: "UNKNOWN",
                        via: [
                            {
                                source: 1,
                                name: "foo",
                                title: "Test",
                                severity: "UNKNOWN",
                                range: "*"
                            }
                        ],
                        fixAvailable: false
                    }
                }
            });

            const results = parser.parse({
                jsonOutput: npmAuditOutput,
                packageManager: "npm"
            });

            expect(results[0]!.severity).toBe("info");
        });
    });

    describe("yarn audit parsing", () => {
        // Yarn (berry) audit emits NDJSON — one JSON object per line, each
        // shaped like `{ value, children: { ID, Issue, URL, Severity, ... } }`.
        // This mirrors real `yarn npm audit --recursive --json` output (see
        // the fixture in the API-layer AuditParserService test), which is why
        // it's used here instead of the classic yarn v1 `{ type, data }` shape.
        it("parses yarn audit JSONL output", () => {
            const yarnAuditOutput = [
                JSON.stringify({
                    value: "minimist",
                    children: {
                        ID: 1179,
                        Issue: "Prototype Pollution",
                        URL: "https://npmjs.com/advisories/1179",
                        Severity: "critical",
                        "Vulnerable Versions": "<1.2.6"
                    }
                })
            ].join("\n");

            const results = parser.parse({
                jsonOutput: yarnAuditOutput,
                packageManager: "yarn"
            });

            expect(results).toHaveLength(1);
            expect(results[0]!.packageName).toBe("minimist");
            expect(results[0]!.severity).toBe("critical");
        });
    });

    describe("pnpm audit parsing", () => {
        it("parses pnpm audit JSON with advisories record", () => {
            const pnpmAuditOutput = JSON.stringify({
                advisories: {
                    "1234": {
                        module_name: "express",
                        title: "Open Redirect",
                        severity: "moderate",
                        url: "https://npmjs.com/advisories/1234",
                        vulnerable_versions: "<4.19.2",
                        patched_versions: ">=4.19.2",
                        cves: []
                    }
                }
            });

            const results = parser.parse({
                jsonOutput: pnpmAuditOutput,
                packageManager: "pnpm"
            });

            expect(results).toHaveLength(1);
            expect(results[0]!.packageName).toBe("express");
            expect(results[0]!.severity).toBe("moderate");
        });
    });

    it("returns empty array for unsupported package manager", () => {
        const results = parser.parse({
            jsonOutput: "{}",
            packageManager: "unknown"
        });
        expect(results).toEqual([]);
    });
});
