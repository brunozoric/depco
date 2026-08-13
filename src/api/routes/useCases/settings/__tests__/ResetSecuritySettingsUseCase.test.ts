import { describe, it, expect, beforeEach } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { ResetSecuritySettingsUseCase } from "../abstractions/ResetSecuritySettingsUseCase.js";

describe("ResetSecuritySettingsUseCase", () => {
    let db: BetterSQLite3Database;
    let useCase: ResetSecuritySettingsUseCase.Interface;

    beforeEach(() => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        useCase = container.resolve(ResetSecuritySettingsUseCase);
    });

    it("replaces existing rows with the registry defaults for the package manager", async () => {
        await db
            .insert(pmSecuritySettings)
            .values({
                id: "custom-setting",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "true",
                enabled: 1
            })
            .run();

        const result = await useCase.execute({ packageManager: "yarn" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBeGreaterThan(0);
        expect(result.value.items).toHaveLength(result.value.total);

        const enableScripts = result.value.items.find(item => item.fieldName === "enableScripts");
        expect(enableScripts?.expectedValue).toBe("false");

        const rows = await db.select().from(pmSecuritySettings).all();
        expect(rows.every(row => row.packageManager === "yarn")).toBe(true);
        expect(rows.some(row => row.id === "custom-setting")).toBe(false);
    });

    it("fails with 400 for an unknown package manager", async () => {
        const result = await useCase.execute({ packageManager: "bogus-pm" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
    });
});
