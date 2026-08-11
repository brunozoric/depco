import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { EnsureDataDirectoryStep } from "../abstractions/EnsureDataDirectoryStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("EnsureDataDirectoryStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "ensure-data-"));
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates data directory when missing", async () => {
        const dataDir = join(workDir, "data");
        const step = container.resolve(EnsureDataDirectoryStep);
        const result = await step.execute(createTestContext(dataDir));
        expect(result.success).toBe(true);
        expect(existsSync(dataDir)).toBe(true);
    });

    it("skips when data directory already exists", async () => {
        const dataDir = join(workDir, "data");
        mkdirSync(dataDir);
        const step = container.resolve(EnsureDataDirectoryStep);
        const result = await step.execute(createTestContext(dataDir));
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("rollback removes empty directory", async () => {
        const dataDir = join(workDir, "data");
        const step = container.resolve(EnsureDataDirectoryStep);
        await step.execute(createTestContext(dataDir));
        expect(existsSync(dataDir)).toBe(true);
        await step.rollback!(createTestContext(dataDir));
        expect(existsSync(dataDir)).toBe(false);
    });
});
