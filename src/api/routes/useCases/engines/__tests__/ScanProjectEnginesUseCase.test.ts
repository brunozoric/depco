import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { EngineService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { ScanProjectEnginesUseCase } from "../abstractions/ScanProjectEnginesUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    engineService?: Partial<EngineService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: ScanProjectEnginesUseCase.Interface;
}

function createEngineServiceStub(
    overrides?: Partial<EngineService.Interface>
): EngineService.Interface {
    return {
        scan: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getByProject: vi.fn(async () => []),
        getSummary: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function insertProject(db: TestDb, id: string): void {
    db.insert(projects)
        .values({
            id,
            name: "sample-project",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    EnginesUseCasesFeature.register(container);
    container.registerInstance(EngineService, createEngineServiceStub(options.engineService));

    return { container, db, useCase: container.resolve(ScanProjectEnginesUseCase) };
}

describe("ScanProjectEnginesUseCase", () => {
    it("scans the project's engines when it exists", async () => {
        const projectId = generateId();
        const scanResult: EngineService.ScanResult = {
            rootStatus: "active-lts",
            rootEnginesNode: ">=18",
            findings: [],
            summary: {
                totalProjects: 1,
                counts: { eol: 0, maintenance: 0, activeLts: 1, current: 0, unknown: 0 },
                projectSummaries: [],
                staleProjectCount: 0,
                stalenessThresholdMs: 604_800_000
            }
        };
        const scan = vi.fn(async () => scanResult);
        const { useCase, db } = createContext({ engineService: { scan } });
        insertProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual(scanResult);
    });

    it("passes warnMaintenance through to the engine service when provided", async () => {
        const projectId = generateId();
        const scan = vi.fn(async () => ({
            rootStatus: "active-lts" as const,
            rootEnginesNode: null,
            findings: [],
            summary: {
                totalProjects: 1,
                counts: { eol: 0, maintenance: 0, activeLts: 1, current: 0, unknown: 0 },
                projectSummaries: [],
                staleProjectCount: 0,
                stalenessThresholdMs: 604_800_000
            }
        }));
        const { useCase, db } = createContext({ engineService: { scan } });
        insertProject(db, projectId);

        await useCase.execute({ projectId, warnMaintenance: false });

        expect(scan).toHaveBeenCalledWith(
            expect.objectContaining({ projectId, warnMaintenance: false })
        );
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 500 when the engine service throws", async () => {
        const projectId = generateId();
        const scan = vi.fn(async () => {
            throw new Error("scan failed");
        });
        const { useCase, db } = createContext({ engineService: { scan } });
        insertProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "scan failed" });
    });
});
