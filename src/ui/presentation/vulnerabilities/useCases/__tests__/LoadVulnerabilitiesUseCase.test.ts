import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listVulnerabilitiesRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { VulnerabilitiesGateway as VulnerabilitiesGatewayRegistration } from "../../../../features/Vulnerabilities/VulnerabilitiesGateway.js";
import { VulnerabilitiesRepository } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesRepository.js";
import { VulnerabilitiesRepository as VulnerabilitiesRepositoryRegistration } from "../../../../features/Vulnerabilities/VulnerabilitiesRepository.js";
import { LoadVulnerabilitiesUseCase } from "../abstractions/LoadVulnerabilitiesUseCase.js";
import { LoadVulnerabilitiesUseCase as LoadVulnerabilitiesUseCaseRegistration } from "../LoadVulnerabilitiesUseCase.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: VulnerabilitiesRepository.Interface;
    useCase: LoadVulnerabilitiesUseCase.Interface;
}

describe("LoadVulnerabilitiesUseCase", () => {
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
        container.register(VulnerabilitiesGatewayRegistration).inSingletonScope();
        container.register(VulnerabilitiesRepositoryRegistration).inSingletonScope();
        container.register(LoadVulnerabilitiesUseCaseRegistration);

        return {
            repository: container.resolve(VulnerabilitiesRepository),
            useCase: container.resolve(LoadVulnerabilitiesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("calls the gateway and stores the results in the repository", async () => {
        const context = createContext();
        const vulnerability: VulnerabilitiesGateway.VulnerabilityItem = {
            id: "v1",
            projectId: "p1",
            projectName: "my-project",
            packageName: "lodash",
            severity: "high",
            title: "Prototype Pollution",
            advisoryUrl: "https://example.com",
            cveId: "CVE-2020-0001",
            vulnerableRange: "<4.17.21",
            fixVersion: "4.17.21",
            source: "both",
            installedVersion: null,
            dependencyKind: "dependency",
            scannedAt: 1000,
            dismissedAt: null,
            dismissedUntil: null
        };
        mockResult = { items: [vulnerability], total: 1 };

        await context.useCase.execute();

        expect(calls).toEqual([
            { route: listVulnerabilitiesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(context.repository.getVulnerabilities()).toEqual([vulnerability]);
        expect(context.repository.getTotal()).toBe(1);
    });

    it("passes filters through to the gateway", async () => {
        const context = createContext();
        mockResult = { items: [], total: 0 };

        await context.useCase.execute({ severity: "critical", packageName: "lodash" });

        expect(calls).toEqual([
            {
                route: listVulnerabilitiesRoute,
                args: {
                    params: {},
                    query: { severity: "critical", packageName: "lodash" }
                }
            }
        ]);
        expect(context.repository.getVulnerabilities()).toEqual([]);
        expect(context.repository.getTotal()).toBe(0);
    });
});
