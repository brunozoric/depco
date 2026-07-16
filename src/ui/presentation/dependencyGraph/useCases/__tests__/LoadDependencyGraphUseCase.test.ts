import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { getDependencyGraphRoute, getDependencyGraphStatsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { DependencyGraphFeature } from "../../../../features/dependencyGraph/feature.js";
import { DependencyGraphRepository } from "../../../../features/dependencyGraph/abstractions/DependencyGraphRepository.js";
import { LoadDependencyGraphUseCase } from "../abstractions/LoadDependencyGraphUseCase.js";
import { LoadDependencyGraphUseCase as LoadDependencyGraphUseCaseRegistration } from "../LoadDependencyGraphUseCase.js";
import type { DependencyGraphGateway } from "../../../../features/dependencyGraph/abstractions/DependencyGraphGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: DependencyGraphRepository.Interface;
    useCase: LoadDependencyGraphUseCase.Interface;
}

describe("LoadDependencyGraphUseCase", () => {
    let calls: RecordedCall[];
    let mockResults: Record<string, unknown>;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === getDependencyGraphRoute) {
                    return mockResults["graph"] as T;
                }
                if (route === getDependencyGraphStatsRoute) {
                    return mockResults["stats"] as T;
                }
                throw new Error("Unexpected route");
            }
        });
        DependencyGraphFeature.register(container);
        container.register(LoadDependencyGraphUseCaseRegistration);

        return {
            repository: container.resolve(DependencyGraphRepository),
            useCase: container.resolve(LoadDependencyGraphUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResults = {
            graph: {
                edges: [],
                rootPackages: [],
                totalPackages: 0,
                maxDepth: 0,
                edgeCount: 0
            },
            stats: {
                totalPackages: 0,
                maxDepth: 0,
                rootCount: 0,
                edgeCount: 0
            }
        };
    });

    it("fetches the graph and stats, storing both in the repository", async () => {
        const context = createContext();
        const graph: DependencyGraphGateway.Graph = {
            edges: [
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    dependencyType: "prod",
                    depth: 0
                }
            ],
            rootPackages: ["lodash"],
            totalPackages: 1,
            maxDepth: 0,
            edgeCount: 1
        };
        const stats: DependencyGraphGateway.Stats = {
            totalPackages: 1,
            maxDepth: 0,
            rootCount: 1,
            edgeCount: 1
        };
        mockResults["graph"] = graph;
        mockResults["stats"] = stats;

        await context.useCase.execute("project-1");

        expect(calls).toEqual([
            {
                route: getDependencyGraphRoute,
                args: { params: { projectId: "project-1" }, query: {} }
            },
            {
                route: getDependencyGraphStatsRoute,
                args: { params: { projectId: "project-1" } }
            }
        ]);
        expect(context.repository.getGraph()).toEqual(graph);
        expect(context.repository.getStats()).toEqual(stats);
    });
});
