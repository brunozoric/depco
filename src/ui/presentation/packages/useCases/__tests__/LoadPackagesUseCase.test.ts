import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listPackagesRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { PackagesGateway as PackagesGatewayRegistration } from "../../../../features/packages/PackagesGateway.js";
import { PackagesRepository } from "../../../../features/packages/abstractions/PackagesRepository.js";
import { PackagesRepository as PackagesRepositoryRegistration } from "../../../../features/packages/PackagesRepository.js";
import { LoadPackagesUseCase } from "../abstractions/LoadPackagesUseCase.js";
import { LoadPackagesUseCase as LoadPackagesUseCaseRegistration } from "../LoadPackagesUseCase.js";
import type { PackagesGateway } from "../../../../features/packages/abstractions/PackagesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    packagesRepository: PackagesRepository.Interface;
    loadPackagesUseCase: LoadPackagesUseCase.Interface;
}

describe("LoadPackagesUseCase", () => {
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
        container.register(PackagesGatewayRegistration).inSingletonScope();
        container.register(PackagesRepositoryRegistration).inSingletonScope();
        container.register(LoadPackagesUseCaseRegistration);

        return {
            packagesRepository: container.resolve(PackagesRepository),
            loadPackagesUseCase: container.resolve(LoadPackagesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("calls the gateway and stores the results in the repository", async () => {
        const context = createContext();
        const pkg: PackagesGateway.PackageListItem = {
            name: "left-pad",
            projects: [
                {
                    projectId: "p1",
                    projectName: "my-project",
                    currentVersion: "1.0.0",
                    latestVersion: "2.0.0",
                    upgradeType: "major"
                }
            ],
            changelogCount: 3,
            lastPublishedAt: 1000,
            dependencyKind: "dependency",
            registryResolved: true
        };
        mockResult = { items: [pkg], total: 1 };

        await context.loadPackagesUseCase.execute();

        expect(calls).toEqual([
            { route: listPackagesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(context.packagesRepository.getPackages()).toEqual([pkg]);
        expect(context.packagesRepository.getTotal()).toBe(1);
    });

    it("passes filters through to the gateway", async () => {
        const context = createContext();
        mockResult = { items: [], total: 0 };

        await context.loadPackagesUseCase.execute({
            search: "lodash",
            upgradeType: "minor",
            dependencyKind: "transitive",
            page: 2,
            pageSize: 10
        });

        expect(calls).toEqual([
            {
                route: listPackagesRoute,
                args: {
                    params: {},
                    query: {
                        search: "lodash",
                        upgradeType: "minor",
                        dependencyKind: "transitive",
                        page: "2",
                        pageSize: "10"
                    }
                }
            }
        ]);
        expect(context.packagesRepository.getPackages()).toEqual([]);
        expect(context.packagesRepository.getTotal()).toBe(0);
    });
});
