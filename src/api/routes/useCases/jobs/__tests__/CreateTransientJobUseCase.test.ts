import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { JobsUseCasesFeature } from "../feature.js";
import { CreateTransientJobUseCase } from "../abstractions/CreateTransientJobUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: CreateTransientJobUseCase.Interface;
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
    const { container, db } = createTestApiContainer();
    JobsUseCasesFeature.register(container);
    container.registerInstance(JobWorker, createJobWorkerStub(options.jobWorker));

    return { container, db, useCase: container.resolve(CreateTransientJobUseCase) };
}

describe("CreateTransientJobUseCase", () => {
    it("enqueues a transient job when the project exists", async () => {
        const enqueue = vi.fn(async () => "job-1");
        const { db, useCase } = createContext({ jobWorker: { enqueue } });
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ jobId: "job-1" });
        }
        expect(enqueue).toHaveBeenCalledWith({
            referenceId: "project-1",
            referenceType: "project",
            type: "transient"
        });
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "PROJECT_NOT_FOUND",
            statusCode: 404,
            message: "Project not found"
        });
    });

    it("fails with 403 when the job worker rejects the enqueue", async () => {
        const enqueue = vi.fn(async () => {
            throw new Error("queue is full");
        });
        const { db, useCase } = createContext({ jobWorker: { enqueue } });
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "ENQUEUE_FAILED",
            statusCode: 403,
            message: "queue is full"
        });
    });

    it("fails with 500 when the database is unavailable", async () => {
        const { db, useCase } = createContext();
        closeDatabaseConnection(db);

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.code).toBe("UNEXPECTED_ERROR");
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
