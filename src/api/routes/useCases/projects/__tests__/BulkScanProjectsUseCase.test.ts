import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { upgradeJobs } from "#api/db/schema.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { BulkScanProjectsUseCase, ProjectsUseCasesFeature } from "../index.js";

function createJobWorkerStub(): JobWorker.Interface {
    return {
        enqueue: vi.fn(async () => "job-1"),
        getJob: vi.fn(async () => null),
        getJobsForReference: vi.fn(async () => []),
        processNextJob: vi.fn(async () => undefined),
        cancelJob: vi.fn(async () => undefined),
        listAllJobs: vi.fn(async () => []),
        drain: vi.fn(async () => undefined),
        recoverStaleJobs: vi.fn(async () => undefined),
        waitForJob: vi.fn(async () => {
            throw new Error("not implemented");
        }),
        waitForJobs: vi.fn(async () => []),
        getRunningJobsForReference: vi.fn(async () => [])
    };
}

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const jobWorker = createJobWorkerStub();
    container.registerInstance(JobWorker, jobWorker);
    const useCase = container.resolve(BulkScanProjectsUseCase);
    return { useCase, db, jobWorker };
}

describe("BulkScanProjectsUseCase", () => {
    it("enqueues a scan job for each project without an active scan", async () => {
        const { useCase, jobWorker } = setup();

        const result = await useCase.execute({ projectIds: ["p1", "p2"] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ enqueuedCount: 2, skippedCount: 0 });
        }
        expect(jobWorker.enqueue).toHaveBeenCalledTimes(2);
    });

    it("skips projects that already have a pending or running scan job", async () => {
        const { useCase, db, jobWorker } = setup();
        db.insert(upgradeJobs)
            .values({ id: generateId(), referenceId: "p1", type: "scan", status: "pending" })
            .run();

        const result = await useCase.execute({ projectIds: ["p1", "p2"] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ enqueuedCount: 1, skippedCount: 1 });
        }
        expect(jobWorker.enqueue).toHaveBeenCalledTimes(1);
        expect(jobWorker.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ referenceId: "p2" })
        );
    });

    it("enqueues anyway when force is true, even with an active scan job", async () => {
        const { useCase, db, jobWorker } = setup();
        db.insert(upgradeJobs)
            .values({ id: generateId(), referenceId: "p1", type: "scan", status: "running" })
            .run();

        const result = await useCase.execute({ projectIds: ["p1"], force: true });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ enqueuedCount: 1, skippedCount: 0 });
        }
        expect(jobWorker.enqueue).toHaveBeenCalledTimes(1);
    });
});
