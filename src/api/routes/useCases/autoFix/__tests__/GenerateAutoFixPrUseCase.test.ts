import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { GenerateAutoFixPrUseCase } from "../abstractions/GenerateAutoFixPrUseCase.js";

type TestDb = BetterSQLite3Database;

async function insertTestProject(db: TestDb, id: string): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/repo/${id}`,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

function createStubJobWorker(overrides: Partial<JobWorker.Interface> = {}): JobWorker.Interface {
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
        getRunningJobsForReference: async () => [],
        ...overrides
    };
}

function createUseCase(jobWorker: JobWorker.Interface): {
    useCase: GenerateAutoFixPrUseCase.Interface;
    db: TestDb;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(JobWorker, jobWorker);
    return { useCase: container.resolve(GenerateAutoFixPrUseCase), db };
}

describe("GenerateAutoFixPrUseCase", () => {
    it("enqueues an auto-fix-pr job for an existing project", async () => {
        const jobWorker = createStubJobWorker({ enqueue: vi.fn(async () => "job-abc") });
        const { useCase, db } = createUseCase(jobWorker);
        const projectId = generateId();
        await insertTestProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ jobId: "job-abc" });
        }
        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: projectId,
            referenceType: "project",
            type: "auto-fix-pr"
        });
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = createUseCase(createStubJobWorker());

        const result = await useCase.execute({ projectId: "does-not-exist" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }
    });

    it("returns a 500 error when enqueueing the job fails", async () => {
        const jobWorker = createStubJobWorker({
            enqueue: vi.fn(async () => {
                throw new Error("queue down");
            })
        });
        const { useCase, db } = createUseCase(jobWorker);
        const projectId = generateId();
        await insertTestProject(db, projectId);

        const result = await useCase.execute({ projectId });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "queue down"
            });
        }
    });
});
