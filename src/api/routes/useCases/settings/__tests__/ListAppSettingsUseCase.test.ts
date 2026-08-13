import { describe, it, expect } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { appSettings } from "#api/db/schema.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { ListAppSettingsUseCase } from "../abstractions/ListAppSettingsUseCase.js";

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

describe("ListAppSettingsUseCase", () => {
    let db: BetterSQLite3Database;

    function createUseCase(
        fileConfigService: FileConfigService.Interface = createStubFileConfigService()
    ): ListAppSettingsUseCase.Interface {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        container.registerInstance(FileConfigService, fileConfigService);
        return container.resolve(ListAppSettingsUseCase);
    }

    it("returns an empty list with db configSource when there are no rows and no file config", async () => {
        const useCase = createUseCase();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toEqual([]);
        expect(result.value.total).toBe(0);
        expect(result.value.configSource).toBe("db");
        expect(result.value.fileManaged).toEqual([]);
    });

    it("masks token values and includes non-token values as-is", async () => {
        const useCase = createUseCase();
        await db
            .insert(appSettings)
            .values([
                { key: "github_token", value: "secret-token" },
                { key: "some_other_key", value: "plain-value" }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toEqual(
            expect.arrayContaining([
                { key: "github_token", value: "••••••••" },
                { key: "some_other_key", value: "plain-value" }
            ])
        );
        expect(result.value.total).toBe(2);
    });

    it("reports encryptionAvailable based on the EncryptionService", async () => {
        const useCase = createUseCase();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(typeof result.value.encryptionAvailable).toBe("boolean");
    });

    it("returns configSource 'error' when the file config fails to load", async () => {
        const useCase = createUseCase(
            createStubFileConfigService({
                readGlobalSettings: async () => ({
                    settings: null,
                    error: { type: "json", message: "Invalid JSON" }
                })
            })
        );

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("error");
        expect(result.value.configError).toEqual({ type: "json", message: "Invalid JSON" });
    });

    it("merges file-managed settings and reports them in fileManaged", async () => {
        const useCase = createUseCase(
            createStubFileConfigService({
                readGlobalSettings: async () => ({
                    settings: { branchTemplate: "feature/{{PACKAGE}}" }
                })
            })
        );

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("file");
        expect(result.value.fileManaged).toEqual(["branch_template"]);
        expect(result.value.items).toEqual(
            expect.arrayContaining([{ key: "branch_template", value: "feature/{{PACKAGE}}" }])
        );
    });
});
