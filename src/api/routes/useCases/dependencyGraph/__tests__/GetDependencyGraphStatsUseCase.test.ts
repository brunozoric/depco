import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { DependencyGraphUseCasesFeature } from "../feature.js";
import { GetDependencyGraphStatsUseCase } from "../abstractions/GetDependencyGraphStatsUseCase.js";

interface ICreateContextOptions {
    dependencyGraphService?: Partial<DependencyGraphService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetDependencyGraphStatsUseCase.Interface;
}

function createDependencyGraphServiceStub(
    overrides?: Partial<DependencyGraphService.Interface>
): DependencyGraphService.Interface {
    return {
        getGraph: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        findPaths: vi.fn(async () => []),
        searchPackages: vi.fn(async () => []),
        refreshGraph: vi.fn(async () => 0),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    DependencyGraphUseCasesFeature.register(container);
    container.registerInstance(
        DependencyGraphService,
        createDependencyGraphServiceStub(options.dependencyGraphService)
    );

    return { container, useCase: container.resolve(GetDependencyGraphStatsUseCase) };
}

describe("GetDependencyGraphStatsUseCase", () => {
    it("derives stats from the graph returned by the service", async () => {
        const getGraph = vi.fn(async () => ({
            edges: [],
            rootPackages: ["react", "lodash"],
            totalPackages: 42,
            maxDepth: 5,
            edgeCount: 100
        }));
        const { useCase } = createContext({ dependencyGraphService: { getGraph } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({
                totalPackages: 42,
                maxDepth: 5,
                rootCount: 2,
                edgeCount: 100
            });
        }
        expect(getGraph).toHaveBeenCalledWith("project-1");
    });

    it("fails with 500 when the dependency graph service throws", async () => {
        const getGraph = vi.fn(async () => {
            throw new Error("graph read failed");
        });
        const { useCase } = createContext({ dependencyGraphService: { getGraph } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "graph read failed" });
        }
    });
});
