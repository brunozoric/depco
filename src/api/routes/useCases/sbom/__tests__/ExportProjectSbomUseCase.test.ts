import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { SbomService, SbomFormatterRegistry } from "#api/services/Sbom/index.js";
import { projects } from "#api/db/schema.js";
import { SbomUseCasesFeature } from "../feature.js";
import { ExportProjectSbomUseCase } from "../abstractions/ExportProjectSbomUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    sbomService?: Partial<SbomService.Interface>;
    sbomFormatterRegistry?: Partial<SbomFormatterRegistry.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ExportProjectSbomUseCase.Interface;
}

function createSbomProjectData(
    overrides: Partial<SbomService.ProjectData> = {}
): SbomService.ProjectData {
    return {
        projectName: "Project One",
        projectPath: "/repo/project-1",
        packageManager: "yarn",
        components: [],
        vulnerabilities: [],
        edges: [],
        ...overrides
    };
}

function createSbomServiceStub(overrides?: Partial<SbomService.Interface>): SbomService.Interface {
    return {
        collectForProject: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        collectForAllProjects: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createSbomFormatterRegistryStub(
    overrides?: Partial<SbomFormatterRegistry.Interface>
): SbomFormatterRegistry.Interface {
    return {
        get: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    SbomUseCasesFeature.register(container);
    container.registerInstance(SbomService, createSbomServiceStub(options.sbomService));
    container.registerInstance(
        SbomFormatterRegistry,
        createSbomFormatterRegistryStub(options.sbomFormatterRegistry)
    );

    return { container, db, useCase: container.resolve(ExportProjectSbomUseCase) };
}

async function insertTestProject(db: TestDb, id: string): Promise<void> {
    await db
        .insert(projects)
        .values({ id, name: id, path: `/repo/${id}`, packageManager: "yarn", addedAt: Date.now() })
        .run();
}

describe("ExportProjectSbomUseCase", () => {
    it("formats the project SBOM data using the requested formatter", async () => {
        const projectData = createSbomProjectData();
        const collectForProject = vi.fn(async () => projectData);
        const formatterResult = {
            content: { spdxVersion: "SPDX-2.3" },
            filename: "sbom-project-1.spdx.json",
            mediaType: "application/json"
        };
        const format = vi.fn(() => formatterResult);
        const get = vi.fn(() => ({ name: "spdx", format }));
        const { useCase, db } = createContext({
            sbomService: { collectForProject },
            sbomFormatterRegistry: { get }
        });
        await insertTestProject(db, "project-1");

        const result = await useCase.execute({ projectId: "project-1", format: "spdx" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(formatterResult);
        }
        expect(collectForProject).toHaveBeenCalledWith("project-1");
        expect(get).toHaveBeenCalledWith("spdx");
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project", format: "cyclonedx" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }
    });

    it("fails with 500 when the SBOM service throws", async () => {
        const collectForProject = vi.fn(async () => {
            throw new Error("collection failed");
        });
        const format = vi.fn();
        const get = vi.fn(() => ({ name: "cyclonedx", format }));
        const { useCase, db } = createContext({
            sbomService: { collectForProject },
            sbomFormatterRegistry: { get }
        });
        await insertTestProject(db, "project-1");

        const result = await useCase.execute({ projectId: "project-1", format: "cyclonedx" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "collection failed"
            });
        }
        expect(format).not.toHaveBeenCalled();
    });
});
