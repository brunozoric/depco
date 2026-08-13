import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { JobsUseCasesFeature } from "../feature.js";
import { CancelJobUseCase } from "../abstractions/CancelJobUseCase.js";

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: CancelJobUseCase.Interface;
}

function createJobWorkerStub(overrides?: Partial<JobWorker.Interface>): JobWorker.Interface {
    return {
        enqueue: vi.fn(async () => "job-stub"),
        getJob: vi.fn(async () => null),
        getJobsForReference: vi.fn(async () => []),
        processNextJob: vi.fn(async () => {}),
        cancelJob: vi.fn(async () => {}),
        listAllJobs: vi.fn(async () => []),
        drain: vi.fn(async () => {}),
        recoverStaleJobs: vi.fn(async () => {}),
        waitForJob: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        waitForJobs: vi.fn(async () => []),
        getRunningJobsForReference: vi.fn(async () => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    JobsUseCasesFeature.register(container);
    container.registerInstance(JobWorker, createJobWorkerStub(options.jobWorker));

    return { container, useCase: container.resolve(CancelJobUseCase) };
}

describe("CancelJobUseCase", () => {
    it("cancels the job when it exists", async () => {
        const cancelJob = vi.fn(async () => {});
        const getJob = vi.fn(async () => ({
            id: "job-1",
            referenceId: "project-1",
            referenceType: "project",
            type: "dependency",
            status: "running",
            packages: null,
            logs: null,
            startedAt: Date.now(),
            completedAt: null,
            warning: null,
            parentJobId: null
        }));
        const { useCase } = createContext({ jobWorker: { getJob, cancelJob } });

        const result = await useCase.execute({ jobId: "job-1" });

        expect(result.isOk()).toBe(true);
        expect(cancelJob).toHaveBeenCalledWith("job-1");
    });

    it("fails with 404 when the job does not exist", async () => {
        const { useCase } = createContext({ jobWorker: { getJob: vi.fn(async () => null) } });

        const result = await useCase.execute({ jobId: "missing-job" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Job not found" });
    });

    it("fails with 500 when the job worker throws", async () => {
        const getJob = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ jobWorker: { getJob } });

        const result = await useCase.execute({ jobId: "job-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "db unavailable" });
    });
});
