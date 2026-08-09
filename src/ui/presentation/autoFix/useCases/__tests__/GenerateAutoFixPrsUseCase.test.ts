import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { generateAutoFixPrRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { AutoFixFeature } from "../../../../features/AutoFix/feature.js";
import { GenerateAutoFixPrsUseCase } from "../abstractions/GenerateAutoFixPrsUseCase.js";
import { GenerateAutoFixPrsUseCase as GenerateAutoFixPrsUseCaseRegistration } from "../GenerateAutoFixPrsUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    useCase: GenerateAutoFixPrsUseCase.Interface;
}

describe("GenerateAutoFixPrsUseCase", () => {
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
        container.register(GenerateAutoFixPrsUseCaseRegistration);

        return {
            useCase: container.resolve(GenerateAutoFixPrsUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("triggers generation via the gateway and returns the job id", async () => {
        const context = createContext();
        mockResult = { jobId: "job-123" };

        const result = await context.useCase.execute("project-1");

        expect(result).toEqual({ jobId: "job-123" });
        expect(calls).toEqual([
            { route: generateAutoFixPrRoute, args: { params: { projectId: "project-1" } } }
        ]);
    });
});
