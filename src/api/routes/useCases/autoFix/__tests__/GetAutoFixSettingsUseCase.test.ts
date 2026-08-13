import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AutoFixSettingsService } from "#api/services/AutoFix/index.js";
import { GetAutoFixSettingsUseCase } from "../abstractions/GetAutoFixSettingsUseCase.js";

function createFixtureSettings(): AutoFixSettingsService.Settings {
    return {
        id: "settings-1",
        projectId: "p1",
        enabled: true,
        upgradeTypes: ["patch", "minor"],
        groupingStrategy: "single-pr",
        branchPrefix: "auto-fix/",
        createdAt: 1000,
        updatedAt: 1000
    };
}

function createUseCase(
    autoFixSettingsService: AutoFixSettingsService.Interface
): GetAutoFixSettingsUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AutoFixSettingsService, autoFixSettingsService);
    return container.resolve(GetAutoFixSettingsUseCase);
}

describe("GetAutoFixSettingsUseCase", () => {
    it("returns settings resolved from the service", async () => {
        const fixture = createFixtureSettings();
        const getSettingsOrDefaults = vi.fn(async () => fixture);
        const useCase = createUseCase({
            getSettings: vi.fn(async () => null),
            getSettingsOrDefaults,
            updateSettings: vi.fn(async () => fixture)
        });

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(getSettingsOrDefaults).toHaveBeenCalledWith("p1");
    });

    it("returns a 500 error when the service throws", async () => {
        const useCase = createUseCase({
            getSettings: vi.fn(async () => null),
            getSettingsOrDefaults: vi.fn(async () => {
                throw new Error("settings lookup failed");
            }),
            updateSettings: vi.fn(async () => createFixtureSettings())
        });

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "settings lookup failed" });
        }
    });
});
