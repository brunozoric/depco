import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AutoFixSettingsService } from "#api/services/AutoFix/index.js";
import { UpdateAutoFixSettingsUseCase } from "../abstractions/UpdateAutoFixSettingsUseCase.js";

function createFixtureSettings(
    overrides: Partial<AutoFixSettingsService.Settings> = {}
): AutoFixSettingsService.Settings {
    return {
        id: "settings-1",
        projectId: "p1",
        enabled: false,
        upgradeTypes: ["patch"],
        groupingStrategy: "single-pr",
        branchPrefix: "auto-fix/",
        createdAt: 1000,
        updatedAt: 2000,
        ...overrides
    };
}

function createUseCase(
    autoFixSettingsService: AutoFixSettingsService.Interface
): UpdateAutoFixSettingsUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AutoFixSettingsService, autoFixSettingsService);
    return container.resolve(UpdateAutoFixSettingsUseCase);
}

describe("UpdateAutoFixSettingsUseCase", () => {
    it("returns updated settings resolved from the service", async () => {
        const fixture = createFixtureSettings();
        const updateSettings = vi.fn(async () => fixture);
        const useCase = createUseCase({
            getSettings: vi.fn(async () => null),
            getSettingsOrDefaults: vi.fn(async () => fixture),
            updateSettings
        });

        const result = await useCase.execute({ projectId: "p1", input: { enabled: false } });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(updateSettings).toHaveBeenCalledWith("p1", { enabled: false });
    });

    it("returns a 500 error when the service throws", async () => {
        const useCase = createUseCase({
            getSettings: vi.fn(async () => null),
            getSettingsOrDefaults: vi.fn(async () => createFixtureSettings()),
            updateSettings: vi.fn(async () => {
                throw new Error("update failed");
            })
        });

        const result = await useCase.execute({ projectId: "p1", input: { enabled: true } });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "update failed"
            });
        }
    });
});
