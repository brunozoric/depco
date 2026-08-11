import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { DetectPackageManagerStep } from "../abstractions/DetectPackageManagerStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("DetectPackageManagerStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "detect-pm-"));
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("detects yarn from yarn.lock", async () => {
        writeFileSync(join(workDir, "yarn.lock"), "");
        const step = container.resolve(DetectPackageManagerStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("packageManager")).toBe("yarn");
    });

    it("detects npm from package-lock.json", async () => {
        writeFileSync(join(workDir, "package-lock.json"), "{}");
        const step = container.resolve(DetectPackageManagerStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("packageManager")).toBe("npm");
    });

    it("detects pnpm from pnpm-lock.yaml", async () => {
        writeFileSync(join(workDir, "pnpm-lock.yaml"), "");
        const step = container.resolve(DetectPackageManagerStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("packageManager")).toBe("pnpm");
    });

    it("detects bun from bun.lock", async () => {
        writeFileSync(join(workDir, "bun.lock"), "");
        const step = container.resolve(DetectPackageManagerStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("packageManager")).toBe("bun");
    });

    it("fails when no lockfile found", async () => {
        const step = container.resolve(DetectPackageManagerStep);
        const context = createTestContext(workDir);
        const result = await step.execute(context);
        expect(result.success).toBe(false);
        expect(result.message).toContain("No lockfile found");
    });
});
