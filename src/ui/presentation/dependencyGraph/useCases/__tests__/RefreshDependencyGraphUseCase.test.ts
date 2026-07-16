import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    getDependencyGraphRoute,
    getDependencyGraphStatsRoute,
    refreshDependencyGraphRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { DependencyGraphFeature } from "../../../../features/dependencyGraph/feature.js";
import { DependencyGraphRepository } from "../../../../features/dependencyGraph/abstractions/DependencyGraphRepository.js";
import { RefreshDependencyGraphUseCase } from "../abstractions/RefreshDependencyGraphUseCase.js";
import { RefreshDependencyGraphUseCase as RefreshDependencyGraphUseCaseRegistration } from "../RefreshDependencyGraphUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: DependencyGraphRepository.Interface;
    useCase: RefreshDependencyGraphUseCase.Interface;
}

describe("RefreshDependencyGraphUseCase", () => {
    let calls: RecordedCall[];
    let mockResults: Record<string, unknown>;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === refreshDependencyGraphRoute) {
                    return mockResults["refresh"] as T;
                }
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
        container.register(RefreshDependencyGraphUseCaseRegistration);

        return {
            repository: container.resolve(DependencyGraphRepository),
            useCase: container.resolve(RefreshDependencyGraphUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResults = {
            refresh: { edgeCount: 5 },
            graph: {
                edges: [],
                rootPackages: [],
                totalPackages: 0,
                maxDepth: 0,
                edgeCount: 5
            },
            stats: {
                totalPackages: 0,
                maxDepth: 0,
                rootCount: 0,
                edgeCount: 5
            }
        };
    });

    it("triggers a refresh then reloads the graph and stats", async () => {
        const context = createContext();

        await context.useCase.execute("project-1");

        expect(calls).toEqual([
            {
                route: refreshDependencyGraphRoute,
                args: { params: { projectId: "project-1" } }
            },
            {
                route: getDependencyGraphRoute,
                args: { params: { projectId: "project-1" }, query: {} }
            },
            {
                route: getDependencyGraphStatsRoute,
                args: { params: { projectId: "project-1" } }
            }
        ]);
        expect(context.repository.getGraph()).toEqual(mockResults["graph"]);
        expect(context.repository.getStats()).toEqual(mockResults["stats"]);
    });
});
