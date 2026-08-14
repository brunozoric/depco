import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { projects } from "#api/db/schema.js";
import { PackageManagerUseCasesFeature } from "../feature.js";
import { GetPackageManagerUseCase } from "../abstractions/GetPackageManagerUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    packageManagerService?: Partial<PackageManagerService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: GetPackageManagerUseCase.Interface;
}

function createPackageManagerServiceStub(
    overrides?: Partial<PackageManagerService.Interface>
): PackageManagerService.Interface {
    return {
        detect: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getVersion: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        updateVersion: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        audit: vi.fn(async () => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    PackageManagerUseCasesFeature.register(container);
    container.registerInstance(
        PackageManagerService,
        createPackageManagerServiceStub(options.packageManagerService)
    );

    return { container, db, useCase: container.resolve(GetPackageManagerUseCase) };
}

describe("GetPackageManagerUseCase", () => {
    it("returns the current package manager version for a project", async () => {
        const getVersion = vi.fn(async () => "4.17.1");
        const { useCase, db } = createContext({ packageManagerService: { getVersion } });
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "test",
                path: "/tmp/project-1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-1" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ version: "4.17.1" });
        expect(getVersion).toHaveBeenCalledWith("/tmp/project-1", "yarn");
    });

    it("detects the package manager when none is stored on the project", async () => {
        const detect = vi.fn(async () => "npm" as const);
        const getVersion = vi.fn(async () => "9.0.0");
        const { useCase, db } = createContext({ packageManagerService: { detect, getVersion } });
        await db
            .insert(projects)
            .values({
                id: "project-2",
                name: "test-2",
                path: "/tmp/project-2",
                packageManager: null,
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-2" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ version: "9.0.0" });
        expect(detect).toHaveBeenCalledWith("/tmp/project-2");
        expect(getVersion).toHaveBeenCalledWith("/tmp/project-2", "npm");
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ id: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "PROJECT_NOT_FOUND",
            statusCode: 404,
            message: "Project not found"
        });
    });

    it("fails with 500 when reading the version throws", async () => {
        const getVersion = vi.fn(async () => {
            throw new Error("binary not found");
        });
        const { useCase, db } = createContext({ packageManagerService: { getVersion } });
        await db
            .insert(projects)
            .values({
                id: "project-3",
                name: "test-3",
                path: "/tmp/project-3",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-3" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "binary not found"
        });
    });
});
