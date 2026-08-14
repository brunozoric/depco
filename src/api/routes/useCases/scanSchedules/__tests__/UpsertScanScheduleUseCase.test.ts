import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { projects, scanSchedules } from "#api/db/schema.js";
import { UpsertScanScheduleUseCase, ScanSchedulesUseCasesFeature } from "../index.js";

interface ICreateContextOptions {
    scanSchedulerService?: Partial<ScanSchedulerService.Interface>;
}

interface ITestContext {
    container: Container;
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: UpsertScanScheduleUseCase.Interface;
    scanSchedulerService: ScanSchedulerService.Interface;
}

function createScanSchedulerServiceStub(
    overrides?: Partial<ScanSchedulerService.Interface>
): ScanSchedulerService.Interface {
    return {
        init: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        scheduleProject: vi.fn(async () => {}),
        unscheduleProject: vi.fn(async () => {}),
        onGlobalDefaultChanged: vi.fn(async () => {}),
        onScanComplete: vi.fn(async () => {}),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    ScanSchedulesUseCasesFeature.register(container);
    const scanSchedulerService = createScanSchedulerServiceStub(options.scanSchedulerService);
    container.registerInstance(ScanSchedulerService, scanSchedulerService);

    return {
        container,
        db,
        useCase: container.resolve(UpsertScanScheduleUseCase),
        scanSchedulerService
    };
}

function seedProject(db: ReturnType<typeof createTestApiContainer>["db"], projectId: string): void {
    db.insert(projects)
        .values({
            id: projectId,
            name: "my-project",
            path: `/tmp/${projectId}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now()
        })
        .run();
}

describe("UpsertScanScheduleUseCase", () => {
    it("creates a new schedule override when none exists for the project", async () => {
        const { db, useCase, scanSchedulerService } = createContext();
        const projectId = generateId();
        seedProject(db, projectId);

        const result = await useCase.execute({ projectId, interval: "24h" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.projectId).toBe(projectId);
            expect(result.value.interval).toBe("24h");
            expect(result.value.enabled).toBe(true);
        }
        expect(scanSchedulerService.scheduleProject).toHaveBeenCalledWith(projectId);
        const row = db
            .select()
            .from(scanSchedules)
            .where(eq(scanSchedules.projectId, projectId))
            .get();
        expect(row?.interval).toBe("24h");
    });

    it("updates the existing schedule override when one already exists for the project", async () => {
        const { db, useCase, scanSchedulerService } = createContext();
        const projectId = generateId();
        seedProject(db, projectId);
        const scheduleId = generateId();
        db.insert(scanSchedules)
            .values({
                id: scheduleId,
                projectId,
                interval: "6h",
                lastRunAt: null,
                nextRunAt: null,
                enabled: 1,
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ projectId, interval: "weekly" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.id).toBe(scheduleId);
            expect(result.value.interval).toBe("weekly");
        }
        expect(scanSchedulerService.scheduleProject).toHaveBeenCalledWith(projectId);
        const row = db
            .select()
            .from(scanSchedules)
            .where(eq(scanSchedules.projectId, projectId))
            .get();
        expect(row?.interval).toBe("weekly");
        expect(row?.id).toBe(scheduleId);
    });

    it("fails with 500 when rescheduling the project throws", async () => {
        const scheduleProject = vi.fn(async () => {
            throw new Error("scheduler unavailable");
        });
        const { db, useCase } = createContext({ scanSchedulerService: { scheduleProject } });
        const projectId = generateId();
        seedProject(db, projectId);

        const result = await useCase.execute({ projectId, interval: "24h" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "scheduler unavailable"
        });
    });
});
