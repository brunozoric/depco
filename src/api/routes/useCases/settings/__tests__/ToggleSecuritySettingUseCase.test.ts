import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { ToggleSecuritySettingUseCase } from "../abstractions/ToggleSecuritySettingUseCase.js";

describe("ToggleSecuritySettingUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: ToggleSecuritySettingUseCase.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(ToggleSecuritySettingUseCase);

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

    it("toggles an enabled setting to disabled", async () => {
        const result = await useCase.execute({ id: "setting-1" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.enabled).toBe(false);
    });

    it("toggles a disabled setting back to enabled", async () => {
        await useCase.execute({ id: "setting-1" });
        const result = await useCase.execute({ id: "setting-1" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.enabled).toBe(true);
    });

    it("fails with 404 when the setting does not exist", async () => {
        const result = await useCase.execute({ id: "missing-id" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });
});
