import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { DependencyGraphUseCasesFeature } from "../feature.js";
import { GetDependencyGraphUseCase } from "../abstractions/GetDependencyGraphUseCase.js";

interface ICreateContextOptions {
    dependencyGraphService?: Partial<DependencyGraphService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetDependencyGraphUseCase.Interface;
}

function createDependencyGraphServiceStub(
    overrides?: Partial<DependencyGraphService.Interface>
): DependencyGraphService.Interface {
    return {
        getGraph: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        findPaths: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
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

    return { container, useCase: container.resolve(GetDependencyGraphUseCase) };
}

describe("GetDependencyGraphUseCase", () => {
    it("returns the full graph when no package name is given", async () => {
        const graph = {
            edges: [],
            rootPackages: ["react"],
            totalPackages: 10,
            maxDepth: 3,
            edgeCount: 20
        };
        const getGraph = vi.fn(async () => graph);
        const { useCase } = createContext({ dependencyGraphService: { getGraph } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(graph);
        }
        expect(getGraph).toHaveBeenCalledWith("project-1");
    });

    it("returns BFS paths when a package name is given", async () => {
        const paths = [{ target: "lodash", chain: [{ packageName: "lodash", version: "4.0.0" }] }];
        const findPaths = vi.fn(async () => paths);
        const { useCase } = createContext({ dependencyGraphService: { findPaths } });

        const result = await useCase.execute({ projectId: "project-1", packageName: "lodash" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ paths });
        }
        expect(findPaths).toHaveBeenCalledWith({ projectId: "project-1", packageName: "lodash" });
    });

    it("fails with 500 when the dependency graph service throws", async () => {
        const getGraph = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ dependencyGraphService: { getGraph } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "db unavailable"
            });
        }
    });
});
