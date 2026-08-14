import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { EngineService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { BulkScanEnginesUseCase } from "../abstractions/BulkScanEnginesUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    engineService?: Partial<EngineService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: BulkScanEnginesUseCase.Interface;
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

    return { container, db, useCase: container.resolve(BulkScanEnginesUseCase) };
}

describe("BulkScanEnginesUseCase", () => {
    it("scans every project found for the given ids", async () => {
        const projectIdOne = generateId();
        const projectIdTwo = generateId();
        const scan = vi.fn(async () => ({
            rootStatus: "active-lts" as const,
            rootEnginesNode: ">=18",
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
        insertProject(db, projectIdOne);
        insertProject(db, projectIdTwo);

        const result = await useCase.execute({ projectIds: [projectIdOne, projectIdTwo] });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ scannedCount: 2 });
        expect(scan).toHaveBeenCalledTimes(2);
        expect(scan).toHaveBeenCalledWith(
            expect.objectContaining({
                projectId: projectIdOne,
                projectPath: `/tmp/${projectIdOne}`
            })
        );
    });

    it("skips ids that don't match a project and returns a count of the ones scanned", async () => {
        const projectIdOne = generateId();
        const scan = vi.fn(async () => ({
            rootStatus: "current" as const,
            rootEnginesNode: null,
            findings: [],
            summary: {
                totalProjects: 1,
                counts: { eol: 0, maintenance: 0, activeLts: 0, current: 1, unknown: 0 },
                projectSummaries: [],
                staleProjectCount: 0,
                stalenessThresholdMs: 604_800_000
            }
        }));
        const { useCase, db } = createContext({ engineService: { scan } });
        insertProject(db, projectIdOne);

        const result = await useCase.execute({ projectIds: [projectIdOne, "missing-project"] });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ scannedCount: 1 });
        expect(scan).toHaveBeenCalledTimes(1);
    });

    it("fails with 500 when the engine service throws", async () => {
        const projectIdOne = generateId();
        const scan = vi.fn(async () => {
            throw new Error("scan failed");
        });
        const { useCase, db } = createContext({ engineService: { scan } });
        insertProject(db, projectIdOne);

        const result = await useCase.execute({ projectIds: [projectIdOne] });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "scan failed"
        });
    });
});
