import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { DependencyGraphUseCasesFeature } from "../feature.js";
import { SearchDependencyPackagesUseCase } from "../abstractions/SearchDependencyPackagesUseCase.js";

interface ICreateContextOptions {
    dependencyGraphService?: Partial<DependencyGraphService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: SearchDependencyPackagesUseCase.Interface;
}

function createDependencyGraphServiceStub(
    overrides?: Partial<DependencyGraphService.Interface>
): DependencyGraphService.Interface {
    return {
        getGraph: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        findPaths: vi.fn(async () => []),
        searchPackages: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
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

    return { container, useCase: container.resolve(SearchDependencyPackagesUseCase) };
}

describe("SearchDependencyPackagesUseCase", () => {
    it("returns matching package names from the dependency graph service", async () => {
        const searchPackages = vi.fn(async () => ["lodash", "lodash.merge"]);
        const { useCase } = createContext({ dependencyGraphService: { searchPackages } });

        const result = await useCase.execute({
            projectId: "project-1",
            query: "lodash",
            limit: 10
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ packages: ["lodash", "lodash.merge"] });
        }
        expect(searchPackages).toHaveBeenCalledWith({
            projectId: "project-1",
            query: "lodash",
            limit: 10
        });
    });

    it("omits the limit field when not provided", async () => {
        const searchPackages = vi.fn(async () => []);
        const { useCase } = createContext({ dependencyGraphService: { searchPackages } });

        await useCase.execute({ projectId: "project-1", query: "react" });

        expect(searchPackages).toHaveBeenCalledWith({ projectId: "project-1", query: "react" });
    });

    it("fails with 500 when the dependency graph service throws", async () => {
        const searchPackages = vi.fn(async () => {
            throw new Error("query failed");
        });
        const { useCase } = createContext({ dependencyGraphService: { searchPackages } });

        const result = await useCase.execute({ projectId: "project-1", query: "react" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "query failed"
            });
        }
    });
});
