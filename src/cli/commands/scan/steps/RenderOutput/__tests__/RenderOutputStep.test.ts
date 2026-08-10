import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { RenderOutputStep } from "../abstractions/RenderOutputStep.js";
import { RenderOutputStepFeature } from "../feature.js";
import { OutputFormatterFeature } from "../../../formatters/feature.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(overrides?: Record<string, unknown>): IStepContext {
    const results = new Map<string, unknown>();
    results.set("violations", [
        { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "copyleft" }
    ]);
    results.set("vulnerabilities", [
        {
            packageName: "vuln-pkg",
            installedVersion: "1.0.0",
            severity: "critical",
            title: "RCE",
            advisoryUrl: null,
            cveId: "CVE-2024-1234",
            dedupKey: "CVE-2024-1234",
            vulnerableRange: "<2.0.0",
            fixVersion: "2.0.0",
            source: "audit"
        }
    ]);
    results.set("packages", [
        { name: "a", version: "1.0.0" },
        { name: "b", version: "2.0.0" }
    ]);
    results.set("config", { scan: { vulnerability: { maxSeverity: "moderate" } } });
    return {
        dataDirectory: "/tmp/test",
        envFilePath: ".env",
        options: { format: "json", ...overrides },
        results
    };
}

describe("RenderOutputStep", () => {
    let step: RenderOutputStep.Interface;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [OutputFormatterFeature, RenderOutputStepFeature]);
        step = container.resolve(RenderOutputStep);
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("outputs formatted results to stdout", async () => {
        const context = createTestContext();
        await step.execute(context);

        expect(consoleSpy).toHaveBeenCalled();
        const output = consoleSpy.mock.calls[0][0];
        const parsed = JSON.parse(output);
        expect(parsed.findings.license).toHaveLength(1);
        expect(parsed.findings.vulnerability).toHaveLength(1);
    });

    it("builds correct summary counts", async () => {
        const context = createTestContext();
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.summary.licenseViolations).toBe(1);
        expect(output.summary.vulnerabilities.critical).toBe(1);
        expect(output.summary.total).toBe(2);
    });

    it("handles missing violations gracefully (empty array)", async () => {
        const context = createTestContext();
        context.results.delete("violations");
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.findings.license).toEqual([]);
    });

    it("handles missing vulnerabilities gracefully (empty array)", async () => {
        const context = createTestContext();
        context.results.delete("vulnerabilities");
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.findings.vulnerability).toEqual([]);
    });

    it("defaults to table format when no --format specified", async () => {
        const context = createTestContext({ format: undefined });
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        // Table output contains ANSI escape codes
        expect(consoleSpy.mock.calls[0][0]).toContain("\x1b[");
    });

    it("sets exit code 1 when vulnerability exceeds maxSeverity threshold", async () => {
        const context = createTestContext();
        const originalExitCode = process.exitCode;
        process.exitCode = undefined;

        await step.execute(context);

        // critical (index 0) <= moderate (index 2) → exit 1
        expect(process.exitCode).toBe(1);
        process.exitCode = originalExitCode;
    });

    it("does not set exit code when no vulnerability exceeds threshold", async () => {
        const context = createTestContext();
        // Isolate vulnerability-threshold behavior from the license-violation exit path.
        context.results.delete("violations");
        context.results.set("config", {
            scan: { vulnerability: { maxSeverity: "critical" } }
        });
        // Only critical vulns trigger exit, and we have one critical → exit 1
        // Change to lower severity to test no-exit case
        context.results.set("vulnerabilities", [
            {
                packageName: "low-vuln",
                installedVersion: "1.0.0",
                severity: "low",
                title: "Minor",
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash1",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            }
        ]);

        const originalExitCode = process.exitCode;
        process.exitCode = undefined;

        await step.execute(context);

        // low (index 3) > critical (index 0) → no exit
        expect(process.exitCode).toBeUndefined();
        process.exitCode = originalExitCode;
    });

    it("does not set exit code when no maxSeverity configured", async () => {
        const context = createTestContext();
        // Isolate vulnerability-threshold behavior from the license-violation exit path.
        context.results.delete("violations");
        context.results.set("config", {});

        const originalExitCode = process.exitCode;
        process.exitCode = undefined;

        await step.execute(context);

        expect(process.exitCode).toBeUndefined();
        process.exitCode = originalExitCode;
    });

    it("sets exit code 1 when license violations exist, even with no maxSeverity configured", async () => {
        const context = createTestContext();
        context.results.delete("vulnerabilities");
        context.results.set("config", {});

        const originalExitCode = process.exitCode;
        process.exitCode = undefined;

        await step.execute(context);

        expect(process.exitCode).toBe(1);
        process.exitCode = originalExitCode;
    });

    it("does not set exit code when there are no violations and no vulnerabilities", async () => {
        const context = createTestContext();
        context.results.delete("violations");
        context.results.delete("vulnerabilities");
        context.results.set("config", {});

        const originalExitCode = process.exitCode;
        process.exitCode = undefined;

        await step.execute(context);

        expect(process.exitCode).toBeUndefined();
        process.exitCode = originalExitCode;
    });
});
