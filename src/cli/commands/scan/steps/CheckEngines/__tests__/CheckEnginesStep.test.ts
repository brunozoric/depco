import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { CheckEnginesStep } from "../abstractions/CheckEnginesStep.js";
import type { IEnginesFinding } from "#shared/engines/types.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

interface IPackageJsonFixture {
    name?: string;
    version?: string;
    engines?: { node?: string };
}

function writePackageJson(directory: string, packageJson: IPackageJsonFixture): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify(packageJson));
}

function createTestContext(overrides?: Partial<IStepContext>): IStepContext {
    return {
        dataDirectory: "/fake",
        envFilePath: ".env",
        options: { check: "engines" },
        results: new Map<string, unknown>([["config", {}]]),
        ...overrides
    };
}

describe("CheckEnginesStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;
    let tempDirectory: string;

    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        container = createTestCliContainer();
        tempDirectory = mkdtempSync(join(tmpdir(), "check-engines-step-"));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        rmSync(tempDirectory, { recursive: true, force: true });
    });

    it("skips when check is not 'engines' and not 'all'", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", engines: { node: ">=16" } });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({
            dataDirectory: tempDirectory,
            options: { check: "license" }
        });
        const result = await step.execute(context);

        expect(result.skipped).toBe(true);
        expect(context.results.has("engines")).toBe(false);
    });

    it("runs when check is 'all'", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", engines: { node: ">=16" } });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({
            dataDirectory: tempDirectory,
            options: { check: "all" }
        });
        const result = await step.execute(context);

        expect(result.skipped).toBeFalsy();
        expect(context.results.has("engines")).toBe(true);
    });

    it("reads root package.json engines.node and classifies as eol for an old major", async () => {
        writePackageJson(tempDirectory, {
            name: "root-pkg",
            version: "1.0.0",
            engines: { node: ">=16" }
        });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        await step.execute(context);

        const findings = context.results.get("engines") as IEnginesFinding[];
        const rootFinding = findings.find(finding => finding.isRoot);

        expect(rootFinding).toEqual({
            packageName: "root-pkg",
            version: "1.0.0",
            enginesNode: ">=16",
            minimumMajor: 16,
            status: "eol",
            eolDate: expect.any(Number),
            isRoot: true
        });
    });

    it("handles missing engines.node with status 'unknown'", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        await step.execute(context);

        const findings = context.results.get("engines") as IEnginesFinding[];
        const rootFinding = findings.find(finding => finding.isRoot);

        expect(rootFinding).toEqual({
            packageName: "root-pkg",
            version: "1.0.0",
            enginesNode: null,
            minimumMajor: null,
            status: "unknown",
            eolDate: null,
            isRoot: true
        });
    });

    it("walks node_modules and classifies dependency engines, including scoped packages", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });
        writePackageJson(join(tempDirectory, "node_modules", "pkg-a"), {
            name: "pkg-a",
            version: "2.0.0",
            engines: { node: ">=24" }
        });
        writePackageJson(join(tempDirectory, "node_modules", "@scope", "pkg-b"), {
            name: "@scope/pkg-b",
            version: "3.0.0",
            engines: { node: ">=16" }
        });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        await step.execute(context);

        const findings = context.results.get("engines") as IEnginesFinding[];
        const dependencyFindings = findings.filter(finding => !finding.isRoot);

        expect(dependencyFindings).toHaveLength(2);

        const pkgA = dependencyFindings.find(finding => finding.packageName === "pkg-a");
        expect(pkgA).toMatchObject({
            packageName: "pkg-a",
            version: "2.0.0",
            enginesNode: ">=24",
            minimumMajor: 24,
            isRoot: false
        });

        const pkgB = dependencyFindings.find(finding => finding.packageName === "@scope/pkg-b");
        expect(pkgB).toMatchObject({
            packageName: "@scope/pkg-b",
            version: "3.0.0",
            enginesNode: ">=16",
            minimumMajor: 16,
            status: "eol",
            isRoot: false
        });
    });

    it("stores findings in context.results under the 'engines' key", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });
        writePackageJson(join(tempDirectory, "node_modules", "pkg-a"), {
            name: "pkg-a",
            version: "2.0.0",
            engines: { node: ">=24" }
        });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        const findings = context.results.get("engines") as IEnginesFinding[];
        expect(findings).toHaveLength(2);
    });

    it("handles missing node_modules gracefully", async () => {
        writePackageJson(tempDirectory, {
            name: "root-pkg",
            version: "1.0.0",
            engines: { node: ">=16" }
        });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        const findings = context.results.get("engines") as IEnginesFinding[];
        expect(findings).toHaveLength(1);
        expect(findings[0]?.isRoot).toBe(true);
    });

    it("handles a missing root package.json gracefully", async () => {
        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        const result = await step.execute(context);

        expect(result.success).toBe(true);
        const findings = context.results.get("engines") as IEnginesFinding[];
        expect(findings).toEqual([
            {
                packageName: "",
                version: "",
                enginesNode: null,
                minimumMajor: null,
                status: "unknown",
                eolDate: null,
                isRoot: true
            }
        ]);
    });

    it("filters packages ignored via config.scan.engines.ignore", async () => {
        writePackageJson(tempDirectory, { name: "root-pkg", version: "1.0.0" });
        writePackageJson(join(tempDirectory, "node_modules", "pkg-a"), {
            name: "pkg-a",
            version: "2.0.0",
            engines: { node: ">=16" }
        });
        writePackageJson(join(tempDirectory, "node_modules", "pkg-b"), {
            name: "pkg-b",
            version: "3.0.0",
            engines: { node: ">=16" }
        });

        const step = container.resolve(CheckEnginesStep);
        const context = createTestContext({ dataDirectory: tempDirectory });
        context.results.set("config", {
            scan: {
                engines: { ignore: ["pkg-a"] },
                ignoredPackages: ["pkg-b"]
            }
        });
        await step.execute(context);

        const findings = context.results.get("engines") as IEnginesFinding[];
        expect(findings.map(finding => finding.packageName)).toEqual(["root-pkg"]);
    });
});
