import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { JobsUseCasesFeature } from "../feature.js";
import { ListProjectJobsUseCase } from "../abstractions/ListProjectJobsUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: ListProjectJobsUseCase.Interface;
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

    return { container, db, useCase: container.resolve(ListProjectJobsUseCase) };
}

describe("ListProjectJobsUseCase", () => {
    it("returns the jobs for an existing project", async () => {
        const jobs = [
            {
                id: "job-1",
                referenceId: "project-1",
                referenceType: "project",
                type: "scan",
                status: "completed",
                packages: null,
                logs: null,
                startedAt: Date.now(),
                completedAt: Date.now(),
                warning: null,
                parentJobId: null
            }
        ];
        const getJobsForReference = vi.fn(async () => jobs);
        const { db, useCase } = createContext({ jobWorker: { getJobsForReference } });
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: jobs, total: 1 });
        }
        expect(getJobsForReference).toHaveBeenCalledWith("project-1");
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ projectId: "missing-project" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 500 when the database is unavailable", async () => {
        const { db, useCase } = createContext();
        closeDatabaseConnection(db);

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
