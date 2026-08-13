import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { InstallUseCasesFeature } from "../feature.js";
import { InstallProjectUseCase } from "../abstractions/InstallProjectUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: InstallProjectUseCase.Interface;
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
    InstallUseCasesFeature.register(container);
    container.registerInstance(JobWorker, createJobWorkerStub(options.jobWorker));

    return { container, db, useCase: container.resolve(InstallProjectUseCase) };
}

describe("InstallProjectUseCase", () => {
    it("enqueues an install job for a project with a known package manager", async () => {
        const { useCase, db } = createContext();
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "test",
                path: "/tmp/project-1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-1", flags: ["--immutable"] });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ jobId: "job-stub" });
    });

    it("passes the requested flags to the job worker", async () => {
        const enqueue = vi.fn(async () => "job-42");
        const { useCase, db } = createContext({ jobWorker: { enqueue } });
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "test",
                path: "/tmp/project-1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        await useCase.execute({ id: "project-1", flags: ["--immutable", "--check-cache"] });

        expect(enqueue).toHaveBeenCalledWith({
            referenceId: "project-1",
            referenceType: "project",
            type: "install",
            packages: JSON.stringify({ flags: ["--immutable", "--check-cache"] })
        });
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ id: "missing-project", flags: [] });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 400 when the project has no detected package manager", async () => {
        const { useCase, db } = createContext();
        await db
            .insert(projects)
            .values({
                id: "project-2",
                name: "test-2",
                path: "/tmp/project-2",
                packageManager: null,
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-2", flags: [] });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            statusCode: 400,
            message: "No package manager detected for this project"
        });
    });

    it("fails with 500 when the job worker throws", async () => {
        const enqueue = vi.fn(async () => {
            throw new Error("queue unavailable");
        });
        const { useCase, db } = createContext({ jobWorker: { enqueue } });
        await db
            .insert(projects)
            .values({
                id: "project-3",
                name: "test-3",
                path: "/tmp/project-3",
                packageManager: "npm",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-3", flags: [] });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "queue unavailable" });
    });
});
