import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ScanProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

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
    const useCase = container.resolve(ScanProjectUseCase);
    return { useCase, db, jobWorker };
}

describe("ScanProjectUseCase", () => {
    it("enqueues a scan job for an existing project", async () => {
        const { useCase, db, jobWorker } = setup();
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

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.jobId).toBe("job-1");
        }
        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: id,
            referenceType: "project",
            type: "scan",
            packages: JSON.stringify({ force: false })
        });
    });

    it("passes force: true through to the enqueued job's packages payload", async () => {
        const { useCase, db, jobWorker } = setup();
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

        await useCase.execute({ id, force: "true" });

        expect(jobWorker.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ packages: JSON.stringify({ force: true }) })
        );
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "unknown" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
        }
    });
});
