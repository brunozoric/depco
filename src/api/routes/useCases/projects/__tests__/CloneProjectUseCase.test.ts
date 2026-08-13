import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { CloneProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

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
    const useCase = container.resolve(CloneProjectUseCase);
    return { useCase, db, jobWorker };
}

describe("CloneProjectUseCase", () => {
    const testDirs: string[] = [];

    afterEach(() => {
        for (const dir of testDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    function createTempDestinationDir(): string {
        const dir = join(
            tmpdir(),
            `clone-project-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(dir, { recursive: true });
        testDirs.push(dir);
        return dir;
    }

    it("enqueues a clone job for a valid https repository URL", async () => {
        const { useCase, jobWorker } = setup();
        const destination = createTempDestinationDir();

        const result = await useCase.execute({
            url: "https://github.com/owner/my-repo.git",
            destination
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.jobId).toBe("job-1");
        }
        expect(jobWorker.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({
                referenceType: "project",
                type: "clone",
                packages: JSON.stringify({
                    url: "https://github.com/owner/my-repo.git",
                    destination: join(destination, "my-repo")
                })
            })
        );
    });

    it("uses a custom folder name when provided", async () => {
        const { useCase } = setup();
        const destination = createTempDestinationDir();

        const result = await useCase.execute({
            url: "git@github.com:owner/my-repo.git",
            destination,
            folderName: "custom-folder"
        });

        expect(result.isOk()).toBe(true);
    });

    it("rejects URLs that are not https:// or git@", async () => {
        const { useCase } = setup();
        const destination = createTempDestinationDir();

        const result = await useCase.execute({ url: "ftp://example.com/repo.git", destination });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(400);
        }
    });

    it("rejects a folder name containing path separators", async () => {
        const { useCase } = setup();
        const destination = createTempDestinationDir();

        const result = await useCase.execute({
            url: "https://github.com/owner/my-repo.git",
            destination,
            folderName: "../escape"
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(400);
        }
    });

    it("returns a 400 error when the destination directory does not exist", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({
            url: "https://github.com/owner/my-repo.git",
            destination: "/no/such/directory"
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(400);
        }
    });

    it("returns a 409 error when a project is already registered at the resolved path", async () => {
        const { useCase, db } = setup();
        const destination = createTempDestinationDir();
        const finalPath = join(destination, "my-repo");
        db.insert(projects)
            .values({
                id: generateId(),
                name: "existing",
                path: finalPath,
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({
            url: "https://github.com/owner/my-repo.git",
            destination
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(409);
        }
    });
});
