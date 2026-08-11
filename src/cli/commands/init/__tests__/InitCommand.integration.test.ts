import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, mkdtempSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sql } from "drizzle-orm";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { InitCommand } from "../abstractions/InitCommand.js";
import { StepRunner } from "../../../runner/abstractions/StepRunner.js";
import { createDatabaseClient } from "#api/db/client.js";
import { users } from "#api/db/schema.js";

vi.mock("@inquirer/prompts", () => ({
    input: vi
        .fn()
        .mockResolvedValueOnce("4000")
        .mockResolvedValueOnce("admin@test.com")
        .mockResolvedValueOnce("Test Admin"),
    password: vi.fn().mockResolvedValueOnce("password123").mockResolvedValueOnce("password123")
}));

describe("InitCommand integration", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "init-integration-"));
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("runs full init flow: data dir, migrations, .env, admin user", async () => {
        const command = container.resolve(InitCommand);
        const runner = container.resolve(StepRunner);

        const context = command.context();
        context.dataDirectory = join(workDir, "data");
        context.envFilePath = join(workDir, ".env");

        await runner.run({ steps: command.steps(), context });

        expect(existsSync(join(workDir, "data"))).toBe(true);

        const dbPath = join(workDir, "data", "manager.db");
        expect(existsSync(dbPath)).toBe(true);

        expect(existsSync(join(workDir, ".env"))).toBe(true);
        const envContent = readFileSync(join(workDir, ".env"), "utf-8");
        expect(envContent).toContain("ENCRYPTION_KEY=");
        expect(envContent).toContain("PORT=4000");
        expect(envContent).toContain("DB_PATH=");

        const permissions = statSync(join(workDir, ".env")).mode & 0o777;
        expect(permissions).toBe(0o600);

        const databaseClient = createDatabaseClient(dbPath);
        const countResult = databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();
        expect(countResult?.count).toBe(1);
    });
});
