import { describe, it, expect } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { ListSecuritySettingsUseCase } from "../abstractions/ListSecuritySettingsUseCase.js";

function createStubFileConfigService(
    overrides: Partial<FileConfigService.Interface> = {}
): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: null }),
        writeGlobalPmSettings: async () => {},
        ...overrides
    };
}

function createUseCase(fileConfigService?: FileConfigService.Interface): {
    useCase: ListSecuritySettingsUseCase.Interface;
    db: BetterSQLite3Database;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(
        FileConfigService,
        fileConfigService ?? createStubFileConfigService()
    );
    return { useCase: container.resolve(ListSecuritySettingsUseCase), db };
}

describe("ListSecuritySettingsUseCase", () => {
    it("returns db rows with configSource 'db' when there is no file config", async () => {
        const { useCase, db } = createUseCase();
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

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toHaveLength(1);
        expect(result.value.configSource).toBe("db");
        expect(result.value.fileManagedPms).toEqual([]);
    });

    it("returns configSource 'error' when the file config fails to load", async () => {
        const { useCase } = createUseCase(
            createStubFileConfigService({
                readGlobalConfig: async () => ({
                    config: null,
                    error: { type: "json", message: "bad json" }
                })
            })
        );

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("error");
        expect(result.value.configError).toEqual({ type: "json", message: "bad json" });
    });

    it("merges file-managed security settings and excludes overridden db rows for that pm", async () => {
        const { useCase, db } = createUseCase(
            createStubFileConfigService({
                readGlobalConfig: async () => ({
                    config: { pmSettings: { yarn: { security: { enableScripts: "true" } } } }
                })
            })
        );
        await db
            .insert(pmSecuritySettings)
            .values([
                {
                    id: "setting-yarn",
                    packageManager: "yarn",
                    configFile: ".yarnrc.yml",
                    fieldName: "enableScripts",
                    expectedValue: "false",
                    enabled: 1
                },
                {
                    id: "setting-npm",
                    packageManager: "npm",
                    configFile: ".npmrc",
                    fieldName: "some-field",
                    expectedValue: "value",
                    enabled: 1
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("file");
        expect(result.value.fileManagedPms).toEqual(["yarn"]);
        // The npm db row survives (not file-managed); the yarn db row is
        // replaced by the file-derived entry.
        expect(result.value.items.some(item => item.id === "setting-npm")).toBe(true);
        expect(result.value.items.some(item => item.id === "setting-yarn")).toBe(false);
        expect(
            result.value.items.some(
                item => item.packageManager === "yarn" && item.expectedValue === "true"
            )
        ).toBe(true);
    });
});
