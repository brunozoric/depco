import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { CreateSecuritySettingUseCase } from "../abstractions/CreateSecuritySettingUseCase.js";

describe("CreateSecuritySettingUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: CreateSecuritySettingUseCase.Interface;

    beforeEach(() => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(CreateSecuritySettingUseCase);
    });

    it("creates a new security setting and persists it", async () => {
        const result = await useCase.execute({
            packageManager: "yarn",
            fieldName: "enableScripts",
            expectedValue: "true"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual({
            id: expect.any(String),
            packageManager: "yarn",
            configFile: ".yarnrc.yml",
            fieldName: "enableScripts",
            expectedValue: "true",
            enabled: true
        });

        const row = await db
            .select()
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.id, result.value.id))
            .get();
        expect(row).toBeDefined();
        expect(row?.expectedValue).toBe("true");
    });

    it("fails with 400 for an unknown package manager", async () => {
        const result = await useCase.execute({
            packageManager: "bogus-pm",
            fieldName: "enableScripts",
            expectedValue: "true"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toContain("Unknown package manager");
    });

    it("fails with 400 for an unknown field", async () => {
        const result = await useCase.execute({
            packageManager: "yarn",
            fieldName: "bogusField",
            expectedValue: "true"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toContain("Unknown field");
    });

    it("fails with 400 when the expected value fails schema validation", async () => {
        const result = await useCase.execute({
            packageManager: "yarn",
            fieldName: "enableScripts",
            expectedValue: "maybe"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
    });

    it("fails with 409 when the setting already exists", async () => {
        await useCase.execute({
            packageManager: "yarn",
            fieldName: "enableScripts",
            expectedValue: "true"
        });

        const result = await useCase.execute({
            packageManager: "yarn",
            fieldName: "enableScripts",
            expectedValue: "false"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(409);
    });
});
