import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { projects } from "#api/db/schema.js";
import { PackageManagerUseCasesFeature } from "../feature.js";
import { UpdatePackageManagerUseCase } from "../abstractions/UpdatePackageManagerUseCase.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ICreateContextOptions {
    jobWorker?: Partial<JobWorker.Interface>;
    packageManagerService?: Partial<PackageManagerService.Interface>;
}

interface ITestContext {
    container: Container;
    db: TestDb;
    useCase: UpdatePackageManagerUseCase.Interface;
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

function createPackageManagerServiceStub(
    overrides?: Partial<PackageManagerService.Interface>
): PackageManagerService.Interface {
    return {
        detect: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getVersion: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        updateVersion: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        audit: vi.fn(async () => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container, db } = createTestApiContainer();
    PackageManagerUseCasesFeature.register(container);
    container.registerInstance(JobWorker, createJobWorkerStub(options.jobWorker));
    container.registerInstance(
        PackageManagerService,
        createPackageManagerServiceStub(options.packageManagerService)
    );

    return { container, db, useCase: container.resolve(UpdatePackageManagerUseCase) };
}

describe("UpdatePackageManagerUseCase", () => {
    it("enqueues a packageManager job with the current and target versions", async () => {
        const enqueue = vi.fn(async () => "job-1");
        const getVersion = vi.fn(async () => "4.17.1");
        const { useCase, db } = createContext({
            jobWorker: { enqueue },
            packageManagerService: { getVersion }
        });
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

        const result = await useCase.execute({ id: "project-1", version: "4.20.0" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ jobId: "job-1" });
        expect(enqueue).toHaveBeenCalledWith({
            referenceId: "project-1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.17.1", to: "4.20.0" }
        });
    });

    it("detects the package manager when none is stored on the project", async () => {
        const detect = vi.fn(async () => "npm" as const);
        const getVersion = vi.fn(async () => "9.0.0");
        const { useCase, db } = createContext({
            packageManagerService: { detect, getVersion }
        });
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

        const result = await useCase.execute({ id: "project-2", version: "10.0.0" });

        expect(result.isOk()).toBe(true);
        expect(detect).toHaveBeenCalledWith("/tmp/project-2");
    });

    it("falls back to the project's stored pmVersion when reading the current version throws", async () => {
        const getVersion = vi.fn(async () => {
            throw new Error("binary not found");
        });
        const { useCase, db } = createContext({ packageManagerService: { getVersion } });
        await db
            .insert(projects)
            .values({
                id: "project-3",
                name: "test-3",
                path: "/tmp/project-3",
                packageManager: "yarn",
                pmVersion: "3.9.9",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-3", version: "4.0.0" });

        expect(result.isOk()).toBe(true);
    });

    it("fails with 404 when the project does not exist", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({ id: "missing-project", version: "1.0.0" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Project not found" });
    });

    it("fails with 500 when package manager detection throws", async () => {
        const detect = vi.fn(async () => {
            throw new Error("detect failed");
        });
        const { useCase, db } = createContext({ packageManagerService: { detect } });
        await db
            .insert(projects)
            .values({
                id: "project-4",
                name: "test-4",
                path: "/tmp/project-4",
                packageManager: null,
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-4", version: "1.0.0" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "detect failed" });
    });

    it("fails with 403 when enqueueing the job is rejected", async () => {
        const enqueue = vi.fn(async () => {
            throw new Error("Security check failed");
        });
        const getVersion = vi.fn(async () => "4.17.1");
        const { useCase, db } = createContext({
            jobWorker: { enqueue },
            packageManagerService: { getVersion }
        });
        await db
            .insert(projects)
            .values({
                id: "project-5",
                name: "test-5",
                path: "/tmp/project-5",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id: "project-5", version: "4.20.0" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 403, message: "Security check failed" });
    });
});
