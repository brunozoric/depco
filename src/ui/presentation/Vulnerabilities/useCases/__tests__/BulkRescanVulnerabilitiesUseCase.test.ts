import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { bulkRescanVulnerabilitiesRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { VulnerabilitiesFeature } from "../../../../features/Vulnerabilities/feature.js";
import { BulkRescanVulnerabilitiesUseCase } from "../abstractions/BulkRescanVulnerabilitiesUseCase.js";
import { BulkRescanVulnerabilitiesUseCase as BulkRescanVulnerabilitiesUseCaseRegistration } from "../BulkRescanVulnerabilitiesUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    useCase: BulkRescanVulnerabilitiesUseCase.Interface;
}

describe("BulkRescanVulnerabilitiesUseCase", () => {
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
        VulnerabilitiesFeature.register(container);
        container.register(BulkRescanVulnerabilitiesUseCaseRegistration);

        return {
            useCase: container.resolve(BulkRescanVulnerabilitiesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("calls gateway bulkRescan and returns projects queued", async () => {
        const context = createContext();
        mockResult = { projectsQueued: 3 };

        const count = await context.useCase.execute(["id1", "id2"]);

        expect(count).toBe(3);
        expect(calls).toEqual([
            {
                route: bulkRescanVulnerabilitiesRoute,
                args: { params: {}, body: { ids: ["id1", "id2"] } }
            }
        ]);
    });
});
