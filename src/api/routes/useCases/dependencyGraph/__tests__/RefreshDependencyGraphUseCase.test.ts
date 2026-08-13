import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { DependencyGraphService } from "#api/services/DependencyGraph/index.js";
import { projects } from "#api/db/schema.js";
import { DependencyGraphUseCasesFeature } from "../feature.js";
import { RefreshDependencyGraphUseCase } from "../abstractions/RefreshDependencyGraphUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    dependencyGraphService?: Partial<DependencyGraphService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: RefreshDependencyGraphUseCase.Interface;
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
        refreshGraph: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    DependencyGraphUseCasesFeature.register(container);
    container.registerInstance(
        DependencyGraphService,
        createDependencyGraphServiceStub(options.dependencyGraphService)
    );

    return { container, db, useCase: container.resolve(RefreshDependencyGraphUseCase) };
}

async function insertTestProject(
    db: TestDb,
    id: string,
    packageManager: string | null
): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/repo/${id}`,
            packageManager,
            addedAt: Date.now()
        })
        .run();
}

describe("RefreshDependencyGraphUseCase", () => {
    it("refreshes the graph for an existing project with a known package manager", async () => {
        const refreshGraph = vi.fn(async () => 15);
        const { useCase, db } = createContext({ dependencyGraphService: { refreshGraph } });
        await insertTestProject(db, "project-1", "yarn");

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ edgeCount: 15 });
        }
        expect(refreshGraph).toHaveBeenCalledWith("project-1", "/repo/project-1", "yarn");
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
        }
    });

    it("fails with 400 when the project has no detected package manager", async () => {
        const { useCase, db } = createContext();
        await insertTestProject(db, "project-1", null);

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                statusCode: 400,
                message: "Project has no detected package manager"
            });
        }
    });

    it("fails with 500 when the dependency graph service throws", async () => {
        const refreshGraph = vi.fn(async () => {
            throw new Error("lockfile parse failed");
        });
        const { useCase, db } = createContext({ dependencyGraphService: { refreshGraph } });
        await insertTestProject(db, "project-1", "yarn");

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "lockfile parse failed" });
        }
    });
});
