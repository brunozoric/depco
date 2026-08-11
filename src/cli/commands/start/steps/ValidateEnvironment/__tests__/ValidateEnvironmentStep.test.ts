import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { ValidateEnvironmentStep } from "../abstractions/ValidateEnvironmentStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

describe("ValidateEnvironmentStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "validate-env-"));
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("succeeds when .env exists with ENCRYPTION_KEY", async () => {
        const envPath = join(workDir, ".env");
        writeFileSync(envPath, "ENCRYPTION_KEY=abc123\nPORT=3001\n");
        const step = container.resolve(ValidateEnvironmentStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
    });

    it("fails when .env missing", async () => {
        const step = container.resolve(ValidateEnvironmentStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(false);
    });
});
