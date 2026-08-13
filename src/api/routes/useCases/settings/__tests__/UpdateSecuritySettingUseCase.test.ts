import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { UpdateSecuritySettingUseCase } from "../abstractions/UpdateSecuritySettingUseCase.js";

describe("UpdateSecuritySettingUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: UpdateSecuritySettingUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(UpdateSecuritySettingUseCase);

        await db
            .insert(pmSecuritySettings)
            .values({
                id: "setting-1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false",
                enabled: 1
            })
            .run();
    });

    it("updates the expected value when valid", async () => {
        const result = await useCase.execute({ id: "setting-1", expectedValue: "true" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.expectedValue).toBe("true");

        const row = await db.select().from(pmSecuritySettings).all();
        expect(row[0]?.expectedValue).toBe("true");
    });

    it("fails with 404 when the setting does not exist", async () => {
        const result = await useCase.execute({ id: "missing-id", expectedValue: "true" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });

    it("fails with 400 when the expected value fails the field's schema", async () => {
        const result = await useCase.execute({ id: "setting-1", expectedValue: "maybe" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
    });
});
