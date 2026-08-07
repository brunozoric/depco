import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";
import { eq } from "drizzle-orm";
import { ScanSchedulerServiceImpl } from "../ScanSchedulerService.js";
import type { EventBus } from "../EventBus/index.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockEventBus(): EventBus.Interface {
    return {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    };
}

async function seedProject(db: TestDb, id: string, name: string): Promise<void> {
    await db
        .insert(projects)
        .values({ id, name, path: `/test/${name}`, addedAt: Date.now() })
        .run();
}

describe("ScanSchedulerService", () => {
    let db: TestDb;
    let eventBus: EventBus.Interface;

    beforeEach(async () => {
        db = await createTestDb();
        eventBus = createMockEventBus();
    });

    describe("resolveInterval", () => {
        it("returns per-project interval when override exists", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");
            const now = Date.now();
            await db
                .insert(scanSchedules)
                .values({
                    id: generateId(),
                    projectId,
                    interval: "6h",
                    enabled: 1,
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            const interval = await service.resolveInterval(projectId);
            expect(interval).toBe("6h");
        });

        it("falls back to global default when no override", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");
            await db
                .insert(appSettings)
                .values({ key: "scan_schedule_default", value: "24h" })
                .run();

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            const interval = await service.resolveInterval(projectId);
            expect(interval).toBe("24h");
        });

        it("returns disabled when neither override nor global default exists", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            const interval = await service.resolveInterval(projectId);
            expect(interval).toBe("disabled");
        });
    });

    describe("computeNextRunAt", () => {
        it("computes next run from last run time", () => {
            const lastRun = 1000000;
            const intervalMs = 6 * 60 * 60 * 1000;
            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            const next = service.computeNextRunAt(lastRun, intervalMs);
            expect(next).toBe(lastRun + intervalMs);
        });

        it("uses now when no last run", () => {
            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            const before = Date.now();
            const next = service.computeNextRunAt(null, 6 * 60 * 60 * 1000);
            const after = Date.now();
            expect(next).toBeGreaterThanOrEqual(before + 6 * 60 * 60 * 1000);
            expect(next).toBeLessThanOrEqual(after + 6 * 60 * 60 * 1000);
        });
    });

    describe("onScanComplete", () => {
        it("updates lastRunAt and nextRunAt in DB", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");
            const now = Date.now();
            await db
                .insert(scanSchedules)
                .values({
                    id: generateId(),
                    projectId,
                    interval: "6h",
                    enabled: 1,
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            await service.onScanComplete(projectId);

            const row = await db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, projectId))
                .get();

            expect(row!.lastRunAt).toBeGreaterThan(0);
            expect(row!.nextRunAt).toBeGreaterThan(row!.lastRunAt!);
        });

        it("does nothing when no schedule exists", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            await service.onScanComplete(projectId);

            const row = await db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, projectId))
                .get();

            expect(row).toBeUndefined();
        });

        it("does nothing when interval is disabled", async () => {
            const projectId = generateId();
            await seedProject(db, projectId, "test-project");
            const now = Date.now();
            await db
                .insert(scanSchedules)
                .values({
                    id: generateId(),
                    projectId,
                    interval: "disabled",
                    enabled: 1,
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            const service = new ScanSchedulerServiceImpl(
                { db } as DatabaseClient.Interface,
                eventBus
            );
            await service.onScanComplete(projectId);

            const row = await db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, projectId))
                .get();

            expect(row!.lastRunAt).toBeNull();
        });
    });

    describe("constructor", () => {
        it("subscribes to scan:completed event", () => {
            new ScanSchedulerServiceImpl({ db } as DatabaseClient.Interface, eventBus);
            expect(eventBus.on).toHaveBeenCalledWith("scan:completed", expect.any(Function));
        });
    });
});
