import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sql } from "drizzle-orm";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { createDatabaseClient } from "#api/db/client.js";
import { runMigrations } from "#api/db/migrate.js";
import { users } from "#api/db/schema.js";
import { CreateAdminUserStep } from "../abstractions/CreateAdminUserStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

vi.mock("@inquirer/prompts", () => ({
    input: vi.fn().mockResolvedValueOnce("admin@test.com").mockResolvedValueOnce("Admin User"),
    password: vi.fn().mockResolvedValueOnce("password123").mockResolvedValueOnce("password123")
}));

describe("CreateAdminUserStep", () => {
    let workDir: string;
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), "create-admin-"));
        mkdirSync(join(workDir, "data"), { recursive: true });
        container = createTestCliContainer();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    it("creates admin user in database", async () => {
        const dbPath = join(workDir, "data", "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);

        const step = container.resolve(CreateAdminUserStep);
        const context: IStepContext = {
            dataDirectory: join(workDir, "data"),
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map([["dbPath", dbPath]])
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);

        const count = databaseClient.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .get();
        expect(count?.count).toBe(1);
    });

    it("skips when users already exist", async () => {
        const { input, password } = await import("@inquirer/prompts");
        vi.mocked(input)
            .mockResolvedValueOnce("admin@test.com")
            .mockResolvedValueOnce("Admin User");
        vi.mocked(password)
            .mockResolvedValueOnce("password123")
            .mockResolvedValueOnce("password123");

        const dbPath = join(workDir, "data", "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);

        const step = container.resolve(CreateAdminUserStep);
        const context: IStepContext = {
            dataDirectory: join(workDir, "data"),
            envFilePath: join(workDir, ".env"),
            options: {},
            results: new Map([["dbPath", dbPath]])
        };

        await step.execute(context);

        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });
});
