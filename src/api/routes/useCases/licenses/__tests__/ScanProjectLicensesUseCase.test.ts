import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ScanProjectLicensesUseCase } from "../abstractions/ScanProjectLicensesUseCase.js";
import { insertTestProject, type TestDb } from "./licensesUseCasesTestHelpers.js";

function createStubJobWorker(): JobWorker.Interface {
    return {
        enqueue: vi.fn(async () => "stub-job-id"),
        getJob: async () => null,
        getJobsForReference: async () => [],
        processNextJob: async () => {},
        cancelJob: async () => {},
        listAllJobs: async () => [],
        drain: async () => {},
        recoverStaleJobs: async () => {},
        waitForJob: async () => {
            throw new Error("not implemented");
        },
        waitForJobs: async () => [],
        getRunningJobsForReference: async () => []
    };
}

describe("ScanProjectLicensesUseCase", () => {
    let useCase: ScanProjectLicensesUseCase.Interface;
    let jobWorker: JobWorker.Interface;
    let db: TestDb;

    function createUseCase(): ScanProjectLicensesUseCase.Interface {
        const created = createTestApiContainer();
        db = created.db;
        jobWorker = createStubJobWorker();
        created.container.registerInstance(JobWorker, jobWorker);
        return created.container.resolve(ScanProjectLicensesUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("enqueues a scan job for an existing project", async () => {
        await insertTestProject(db, "proj-1");
        vi.mocked(jobWorker.enqueue).mockResolvedValue("job-123");

        const result = await useCase.execute({ projectId: "proj-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ jobId: "job-123" });
        }
        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: "proj-1",
            referenceType: "project",
            type: "scan"
        });
    });

    it("fails with 404 when the project does not exist", async () => {
        const result = await useCase.execute({ projectId: "does-not-exist" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
        }
        expect(jobWorker.enqueue).not.toHaveBeenCalled();
    });

    it("fails with 500 when enqueueing the job throws", async () => {
        await insertTestProject(db, "proj-1");
        vi.mocked(jobWorker.enqueue).mockRejectedValue(new Error("queue full"));

        const result = await useCase.execute({ projectId: "proj-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "queue full" });
        }
    });
});
