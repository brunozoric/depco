import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { UpdatePmConfigUseCase } from "../abstractions/UpdatePmConfigUseCase.js";

function createStatefulFileConfigService(): {
    service: FileConfigService.Interface;
    writeGlobalPmSettings: ReturnType<typeof vi.fn>;
} {
    let stored: FileConfigService.PmSettings = {};
    const writeGlobalPmSettings = vi.fn(
        async (_pm: string, settings: FileConfigService.PmSettings) => {
            stored = settings;
        }
    );

    const service: FileConfigService.Interface = {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: { pmSettings: { yarn: stored } } }),
        writeGlobalPmSettings
    };

    return { service, writeGlobalPmSettings };
}

function createUseCase(
    fileConfigService: FileConfigService.Interface
): UpdatePmConfigUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(FileConfigService, fileConfigService);
    return container.resolve(UpdatePmConfigUseCase);
}

describe("UpdatePmConfigUseCase", () => {
    it("writes install flags and returns the merged config item", async () => {
        const { service, writeGlobalPmSettings } = createStatefulFileConfigService();
        const useCase = createUseCase(service);

        const result = await useCase.execute({
            pm: "yarn",
            installFlags: { "--immutable": true }
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.packageManager).toBe("yarn");
        expect(writeGlobalPmSettings).toHaveBeenCalledWith(
            "yarn",
            expect.objectContaining({ installFlags: { "--immutable": true } })
        );
        const immutableFlag = result.value.installFlags.find(flag => flag.flag === "--immutable");
        expect(immutableFlag?.enabled).toBe(true);
        expect(immutableFlag?.isFileManaged).toBe(true);
    });

    it("converts an empty registryUrl into undefined so the key is cleared", async () => {
        const { service, writeGlobalPmSettings } = createStatefulFileConfigService();
        const useCase = createUseCase(service);

        await useCase.execute({ pm: "yarn", registryUrl: "" });

        expect(writeGlobalPmSettings).toHaveBeenCalledWith(
            "yarn",
            expect.objectContaining({ registryUrl: undefined })
        );
    });

    it("passes through a non-empty registryUrl", async () => {
        const { service, writeGlobalPmSettings } = createStatefulFileConfigService();
        const useCase = createUseCase(service);

        await useCase.execute({ pm: "yarn", registryUrl: "https://registry.example.com" });

        expect(writeGlobalPmSettings).toHaveBeenCalledWith(
            "yarn",
            expect.objectContaining({ registryUrl: "https://registry.example.com" })
        );
    });

    it("fails with 500 when writing the file config throws", async () => {
        const service: FileConfigService.Interface = {
            readConfig: async () => null,
            readGlobalSettings: async () => ({ settings: null }),
            readGlobalConfig: async () => ({ config: null }),
            writeGlobalPmSettings: async () => {
                throw new Error("disk full");
            }
        };
        const useCase = createUseCase(service);

        const result = await useCase.execute({ pm: "yarn", registryUrl: "https://example.com" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toBe("disk full");
    });
});
