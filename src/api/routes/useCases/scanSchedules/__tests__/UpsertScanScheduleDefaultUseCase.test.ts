import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { appSettings } from "#api/db/schema.js";
import { SCAN_SCHEDULE_DEFAULT_KEY } from "../scanScheduleHelper.js";
import { UpsertScanScheduleDefaultUseCase, ScanSchedulesUseCasesFeature } from "../index.js";

interface ICreateContextOptions {
    scanSchedulerService?: Partial<ScanSchedulerService.Interface>;
}

interface ITestContext {
    container: Container;
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: UpsertScanScheduleDefaultUseCase.Interface;
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
        useCase: container.resolve(UpsertScanScheduleDefaultUseCase),
        scanSchedulerService
    };
}

describe("UpsertScanScheduleDefaultUseCase", () => {
    it("creates the global default setting when none exists", async () => {
        const { db, useCase, scanSchedulerService } = createContext();

        const result = await useCase.execute({ interval: "24h" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ interval: "24h" });
        }
        expect(scanSchedulerService.onGlobalDefaultChanged).toHaveBeenCalled();
        expect(
            db
                .select()
                .from(appSettings)
                .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
                .get()
        ).toEqual({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: "24h" });
    });

    it("updates the global default setting when one already exists", async () => {
        const { db, useCase, scanSchedulerService } = createContext();
        db.insert(appSettings).values({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: "6h" }).run();

        const result = await useCase.execute({ interval: "weekly" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ interval: "weekly" });
        }
        expect(scanSchedulerService.onGlobalDefaultChanged).toHaveBeenCalled();
        expect(
            db
                .select()
                .from(appSettings)
                .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
                .get()
        ).toEqual({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: "weekly" });
    });

    it("fails with 500 when notifying the scheduler throws", async () => {
        const onGlobalDefaultChanged = vi.fn(async () => {
            throw new Error("scheduler unavailable");
        });
        const { useCase } = createContext({
            scanSchedulerService: { onGlobalDefaultChanged }
        });

        const result = await useCase.execute({ interval: "24h" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "scheduler unavailable"
        });
    });
});
