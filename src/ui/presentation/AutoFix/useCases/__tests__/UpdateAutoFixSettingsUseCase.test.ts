import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { updateAutoFixSettingsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { AutoFixFeature } from "../../../../features/AutoFix/feature.js";
import { AutoFixRepository } from "../../../../features/AutoFix/abstractions/AutoFixRepository.js";
import { UpdateAutoFixSettingsUseCase } from "../abstractions/UpdateAutoFixSettingsUseCase.js";
import { UpdateAutoFixSettingsUseCase as UpdateAutoFixSettingsUseCaseRegistration } from "../UpdateAutoFixSettingsUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: AutoFixRepository.Interface;
    useCase: UpdateAutoFixSettingsUseCase.Interface;
}

describe("UpdateAutoFixSettingsUseCase", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createContext(): TestContext {
        const container = createContainer();
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        AutoFixFeature.register(container);
        container.register(UpdateAutoFixSettingsUseCaseRegistration);

        return {
            repository: container.resolve(AutoFixRepository),
            useCase: container.resolve(UpdateAutoFixSettingsUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("updates settings via the gateway and refreshes the repository", async () => {
        const context = createContext();
        const updatedSettings = {
            id: "settings1",
            projectId: "project-1",
            enabled: false,
            upgradeTypes: ["patch", "minor"],
            groupingStrategy: "single",
            branchPrefix: "auto-fix/",
            createdAt: 1000,
            updatedAt: 2000
        };
        mockResult = updatedSettings;

        await context.useCase.execute("project-1", { enabled: false });

        expect(calls).toEqual([
            {
                route: updateAutoFixSettingsRoute,
                args: { params: { projectId: "project-1" }, body: { enabled: false } }
            }
        ]);
        expect(context.repository.getSettings()).toEqual(updatedSettings);
    });
});
