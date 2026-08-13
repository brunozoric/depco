import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, scanResults, securityChecks, upgradeJobs } from "#api/db/schema.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { DeleteProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

function createScanSchedulerServiceStub(): ScanSchedulerService.Interface {
    return {
        init: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        scheduleProject: vi.fn(async () => undefined),
        unscheduleProject: vi.fn(async () => undefined),
        onGlobalDefaultChanged: vi.fn(async () => undefined),
        onScanComplete: vi.fn(async () => undefined)
    };
}

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const scanSchedulerService = createScanSchedulerServiceStub();
    container.registerInstance(ScanSchedulerService, scanSchedulerService);
    const useCase = container.resolve(DeleteProjectUseCase);
    return { useCase, db, scanSchedulerService };
}

describe("DeleteProjectUseCase", () => {
    it("deletes the project and its related rows", async () => {
        const { useCase, db, scanSchedulerService } = setup();
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();
        db.insert(scanResults)
            .values({
                id: generateId(),
                projectId: id,
                name: "react",
                currentVersion: "18.0.0",
                type: "dependency",
                scannedAt: Date.now()
            })
            .run();
        db.insert(securityChecks)
            .values({
                id: generateId(),
                projectId: id,
                checkedAt: Date.now(),
                results: "[]",
                passes: 1
            })
            .run();
        db.insert(upgradeJobs)
            .values({ id: generateId(), referenceId: id, type: "scan", status: "completed" })
            .run();

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        expect(scanSchedulerService.unscheduleProject).toHaveBeenCalledWith(id);

        expect(db.select().from(projects).where(eq(projects.id, id)).all()).toEqual([]);
        expect(db.select().from(scanResults).where(eq(scanResults.projectId, id)).all()).toEqual(
            []
        );
        expect(
            db.select().from(securityChecks).where(eq(securityChecks.projectId, id)).all()
        ).toEqual([]);
        expect(db.select().from(upgradeJobs).where(eq(upgradeJobs.referenceId, id)).all()).toEqual(
            []
        );
    });

    it("returns a 409 error when the project has a running job", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();
        db.insert(upgradeJobs)
            .values({ id: generateId(), referenceId: id, type: "scan", status: "running" })
            .run();

        const result = await useCase.execute({ id });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(409);
            expect(result.error.message).toBe("Cannot delete project with running jobs");
        }
        expect(db.select().from(projects).where(eq(projects.id, id)).all()).toHaveLength(1);
    });
});
