import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { scanProjectLicensesRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { LicensesFeature } from "../../../../features/Licenses/feature.js";
import { ScanLicensesUseCase } from "../abstractions/ScanLicensesUseCase.js";
import { ScanLicensesUseCase as ScanLicensesUseCaseRegistration } from "../ScanLicensesUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    useCase: ScanLicensesUseCase.Interface;
}

describe("ScanLicensesUseCase", () => {
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
        LicensesFeature.register(container);
        container.register(ScanLicensesUseCaseRegistration);

        return {
            useCase: container.resolve(ScanLicensesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("triggers a scan via the gateway and returns the job id", async () => {
        const context = createContext();
        mockResult = { jobId: "job-123" };

        const result = await context.useCase.execute("project-1");

        expect(result).toEqual({ jobId: "job-123" });
        expect(calls).toEqual([
            { route: scanProjectLicensesRoute, args: { params: { projectId: "project-1" } } }
        ]);
    });
});
