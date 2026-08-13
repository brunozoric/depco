import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { Container } from "@webiny/di";
import type { INodeRelease } from "#shared/engines/types.js";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, engineChecks } from "#api/db/schema.js";
import { NodeReleaseDataService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { GetProjectEngineStalenessUseCase } from "../abstractions/GetProjectEngineStalenessUseCase.js";
import { ENGINE_STALENESS_THRESHOLD_MS } from "../engineStaleness.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    nodeReleaseDataService?: Partial<NodeReleaseDataService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: GetProjectEngineStalenessUseCase.Interface;
}

function createNodeReleaseDataServiceStub(
    overrides?: Partial<NodeReleaseDataService.Interface>
): NodeReleaseDataService.Interface {
    return {
        getSchedule: vi.fn(async () => [] as INodeRelease[]),
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

function insertEngineCheck(
    db: TestDb,
    projectId: string,
    overrides: Partial<typeof engineChecks.$inferInsert> = {}
): void {
    db.insert(engineChecks)
        .values({
            id: generateId(),
            projectId,
            packageName: "",
            enginesNode: ">=18",
            minimumMajor: 18,
            status: "active-lts",
            eolDate: null,
            scannedAt: Date.now(),
            ...overrides
        })
        .run();
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    EnginesUseCasesFeature.register(container);
    container.registerInstance(
        NodeReleaseDataService,
        createNodeReleaseDataServiceStub(options.nodeReleaseDataService)
    );

    return { container, db, useCase: container.resolve(GetProjectEngineStalenessUseCase) };
}

describe("GetProjectEngineStalenessUseCase", () => {
    it("is not stale when the project has never been scanned", async () => {
        const projectId = generateId();
        const { useCase, db } = createContext();
        insertProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({
            lastScannedAt: null,
            engineScanStale: false,
            engineScanStaleReason: null,
            stalenessThresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });
    });

    it("is stale by time when the last scan is older than the threshold", async () => {
        const projectId = generateId();
        const now = Date.now();
        const scannedAt = now - ENGINE_STALENESS_THRESHOLD_MS - 10_000;
        const { useCase, db } = createContext();
        insertProject(db, projectId);
        insertEngineCheck(db, projectId, { scannedAt });

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.lastScannedAt).toBe(scannedAt);
            expect(result.value.engineScanStale).toBe(true);
            expect(result.value.engineScanStaleReason).toBe("time");
        }
    });

    it("is stale by release when a newer Node.js release shipped after the last scan", async () => {
        const projectId = generateId();
        const now = Date.now();
        const scannedAt = now - 60_000;
        const getSchedule = vi.fn(async () => [
            {
                version: 22,
                codename: null,
                releaseDate: now,
                ltsStart: null,
                maintenanceStart: null,
                eolDate: now + 1
            }
        ]);
        const { useCase, db } = createContext({ nodeReleaseDataService: { getSchedule } });
        insertProject(db, projectId);
        insertEngineCheck(db, projectId, { scannedAt });

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.engineScanStale).toBe(true);
            expect(result.value.engineScanStaleReason).toBe("release");
        }
    });

    it("fails with 500 when the Node.js release schedule cannot be loaded", async () => {
        const projectId = generateId();
        const getSchedule = vi.fn(async () => {
            throw new Error("endoflife.date unreachable");
        });
        const { useCase, db } = createContext({ nodeReleaseDataService: { getSchedule } });
        insertProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            statusCode: 500,
            message: "endoflife.date unreachable"
        });
    });
});
