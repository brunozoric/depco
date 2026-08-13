import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { ListPmSettingsUseCase } from "../abstractions/ListPmSettingsUseCase.js";

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

function createUseCase(
    fileConfigService: FileConfigService.Interface = createStubFileConfigService()
): ListPmSettingsUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(FileConfigService, fileConfigService);
    return container.resolve(ListPmSettingsUseCase);
}

describe("ListPmSettingsUseCase", () => {
    it("returns default items for all package managers with db configSource when there is no file config", async () => {
        const useCase = createUseCase();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.items).toHaveLength(4);
        expect(result.value.items.map(item => item.packageManager)).toEqual([
            "yarn",
            "npm",
            "pnpm",
            "bun"
        ]);
        expect(result.value.configSource).toBe("db");
        expect(result.value.fileManagedPms).toEqual([]);
    });

    it("returns configSource 'error' when the file config fails to load", async () => {
        const useCase = createUseCase(
            createStubFileConfigService({
                readGlobalConfig: async () => ({
                    config: null,
                    error: { type: "schema", message: "Invalid config" }
                })
            })
        );

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("error");
        expect(result.value.configError).toEqual({ type: "schema", message: "Invalid config" });
    });

    it("marks a package manager as file-managed and merges its settings", async () => {
        const useCase = createUseCase(
            createStubFileConfigService({
                readGlobalConfig: async () => ({
                    config: {
                        pmSettings: { yarn: { registryUrl: "https://registry.example.com" } }
                    }
                })
            })
        );

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.configSource).toBe("file");
        expect(result.value.fileManagedPms).toEqual(["yarn"]);
        const yarnItem = result.value.items.find(item => item.packageManager === "yarn");
        expect(yarnItem?.general.registryUrl).toBe("https://registry.example.com");
    });
});
