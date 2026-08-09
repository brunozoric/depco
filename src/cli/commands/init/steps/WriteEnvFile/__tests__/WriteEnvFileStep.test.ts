import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync, mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createContainer } from "#shared/index.js";
import { WriteEnvFileStepFeature } from "../feature.js";
import { WriteEnvFileStep } from "../abstractions/WriteEnvFileStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

describe("WriteEnvFileStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "write-env-"));
        container = createContainer();
        WriteEnvFileStepFeature.register(container);
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("writes .env with encryption key, port, and db path", async () => {
        const envPath = join(workDir, ".env");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([
                ["encryptionKey", "abc123"],
                ["port", "4000"],
                ["dbPath", "./data/manager.db"]
            ])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const content = readFileSync(envPath, "utf-8");
        expect(content).toContain("ENCRYPTION_KEY=abc123");
        expect(content).toContain("PORT=4000");
        expect(content).toContain("DB_PATH=./data/manager.db");
    });

    it("skips when .env already exists", async () => {
        const envPath = join(workDir, ".env");
        writeFileSync(envPath, "existing");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([
                ["encryptionKey", "x"],
                ["port", "3001"],
                ["dbPath", "./data/manager.db"]
            ])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("rollback removes .env", async () => {
        const envPath = join(workDir, ".env");
        const step = container.resolve(WriteEnvFileStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: envPath,
            options: {},
            results: new Map([
                ["encryptionKey", "x"],
                ["port", "3001"],
                ["dbPath", "./data/manager.db"]
            ])
        };
        await step.execute(context);
        expect(existsSync(envPath)).toBe(true);
        await step.rollback!(context);
        expect(existsSync(envPath)).toBe(false);
    });
});
