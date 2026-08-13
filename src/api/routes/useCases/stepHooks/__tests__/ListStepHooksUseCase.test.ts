import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { PackageJsonService } from "#api/services/PackageJson/index.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHooksUseCasesFeature } from "../feature.js";
import { ListStepHooksUseCase } from "../abstractions/ListStepHooksUseCase.js";

interface ICreateContextOptions {
    fileConfigService?: Partial<FileConfigService.Interface>;
    packageJsonService?: Partial<PackageJsonService.Interface>;
}

interface ITestContext {
    container: Container;
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: ListStepHooksUseCase.Interface;
}

function createFileConfigServiceStub(
    overrides?: Partial<FileConfigService.Interface>
): FileConfigService.Interface {
    return {
        readConfig: vi.fn(async () => null),
        readGlobalSettings: vi.fn(async () => ({ settings: null })),
        readGlobalConfig: vi.fn(async () => ({ config: null })),
        writeGlobalPmSettings: vi.fn(async () => {}),
        ...overrides
    };
}

function createPackageJsonServiceStub(
    overrides?: Partial<PackageJsonService.Interface>
): PackageJsonService.Interface {
    return {
        getScripts: vi.fn(async () => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    StepHooksUseCasesFeature.register(container);
    container.registerInstance(
        FileConfigService,
        createFileConfigServiceStub(options.fileConfigService)
    );
    container.registerInstance(
        PackageJsonService,
        createPackageJsonServiceStub(options.packageJsonService)
    );

    return { container, db, useCase: container.resolve(ListStepHooksUseCase) };
}

describe("ListStepHooksUseCase", () => {
    it("returns db-sourced hooks with scripts not yet configured as discovered", async () => {
        const getScripts = vi.fn(async () => [
            { name: "lint", command: "oxlint" },
            { name: "test", command: "vitest" }
        ]);
        const { db, useCase } = createContext({ packageJsonService: { getScripts } });
        const now = Date.now();
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: now })
            .run();
        db.insert(projectStepHooks)
            .values({
                id: "hook-1",
                projectId: "project-1",
                position: "pre-upgrade",
                name: "lint",
                command: "yarn lint",
                type: "command",
                createdAt: now,
                updatedAt: now
            })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.configSource).toBe("db");
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]?.name).toBe("lint");
            expect(result.value.discoveredScripts).toEqual([{ name: "test", command: "vitest" }]);
        }
    });

    it("returns file-sourced hooks when a file config is present", async () => {
        const fileHook = {
            position: "pre-upgrade" as const,
            name: "Lint",
            command: "yarn lint",
            executionType: "command" as const,
            required: true
        };
        const readConfig = vi.fn(async () => ({ stepHooks: [fileHook] }));
        const getScripts = vi.fn(async () => [{ name: "test", command: "vitest" }]);
        const { db, useCase } = createContext({
            fileConfigService: { readConfig },
            packageJsonService: { getScripts }
        });
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.configSource).toBe("file");
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]).toMatchObject({
                projectId: "project-1",
                position: "pre-upgrade",
                name: "Lint",
                command: "yarn lint",
                type: "command",
                required: true,
                enabled: true,
                source: "file"
            });
            expect(result.value.discoveredScripts).toEqual([{ name: "test", command: "vitest" }]);
        }
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 500 when the file config service throws", async () => {
        const readConfig = vi.fn(async () => {
            throw new Error("disk unavailable");
        });
        const { db, useCase } = createContext({ fileConfigService: { readConfig } });
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "disk unavailable" });
    });
});
