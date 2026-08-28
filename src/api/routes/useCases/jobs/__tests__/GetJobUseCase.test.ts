import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { JobsUseCasesFeature } from "../feature.js";
import { GetJobUseCase } from "../abstractions/GetJobUseCase.js";

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetJobUseCase.Interface;
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

    return { container, useCase: container.resolve(GetJobUseCase) };
}

describe("GetJobUseCase", () => {
    it("returns the job when it belongs to the given project", async () => {
        const job = {
            id: "job-1",
            referenceId: "project-1",
            referenceType: "project",
            type: "dependency",
            status: "completed",
            packages: null,
            logs: null,
            startedAt: Date.now(),
            completedAt: Date.now(),
            warning: null,
            progress: null,
            progressLabel: null,
            parentJobId: null
        };
        const { useCase } = createContext({ jobWorker: { getJob: vi.fn(async () => job) } });

        const result = await useCase.execute({ projectId: "project-1", jobId: "job-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(job);
        }
    });

    it("fails with 404 when the job does not exist", async () => {
        const { useCase } = createContext({ jobWorker: { getJob: vi.fn(async () => null) } });

        const result = await useCase.execute({ projectId: "project-1", jobId: "missing-job" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "JOB_NOT_FOUND",
            statusCode: 404,
            message: "Job not found"
        });
    });

    it("fails with 404 when the job belongs to a different project", async () => {
        const job = {
            id: "job-1",
            referenceId: "project-2",
            referenceType: "project",
            type: "dependency",
            status: "completed",
            packages: null,
            logs: null,
            startedAt: Date.now(),
            completedAt: Date.now(),
            warning: null,
            progress: null,
            progressLabel: null,
            parentJobId: null
        };
        const { useCase } = createContext({ jobWorker: { getJob: vi.fn(async () => job) } });

        const result = await useCase.execute({ projectId: "project-1", jobId: "job-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "JOB_NOT_FOUND",
            statusCode: 404,
            message: "Job not found"
        });
    });

    it("fails with 500 when the job worker throws", async () => {
        const getJob = vi.fn(async () => {
            throw new Error("worker unavailable");
        });
        const { useCase } = createContext({ jobWorker: { getJob } });

        const result = await useCase.execute({ projectId: "project-1", jobId: "job-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "worker unavailable"
        });
    });
});
