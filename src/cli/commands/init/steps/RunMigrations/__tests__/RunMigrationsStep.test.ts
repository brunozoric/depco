import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { RunMigrationsStep } from "../abstractions/RunMigrationsStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(dataDirectory: string): IStepContext {
    return {
        dataDirectory,
        envFilePath: join(dataDirectory, ".env"),
        options: {},
        results: new Map()
    };
}

describe("RunMigrationsStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "run-migrations-"));
        mkdirSync(join(workDir, "data"), { recursive: true });
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates database and runs migrations", async () => {
        const step = container.resolve(RunMigrationsStep);
        const context = createTestContext(join(workDir, "data"));
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(existsSync(join(workDir, "data", "manager.db"))).toBe(true);
    });
});
