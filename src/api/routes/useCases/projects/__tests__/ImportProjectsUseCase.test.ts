import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { SecurityService } from "#api/services/Security/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ImportProjectsUseCase, ProjectsUseCasesFeature } from "../index.js";

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
    container.registerInstance(PackageManagerService, {
        detect: vi.fn(async (): Promise<PackageManagerService.PackageManager> => "yarn"),
        getVersion: vi.fn(async () => "4.17.1"),
        updateVersion: vi.fn(async () => undefined),
        audit: vi.fn(async () => [])
    });
    const securityService: SecurityService.Interface = {
        check: vi.fn(async () => ({ passes: true, checks: {} })),
        getLatest: vi.fn(async () => null),
        getLatestForProjects: vi.fn(async () => new Map())
    };
    container.registerInstance(SecurityService, securityService);
    const jobWorker = createJobWorkerStub();
    container.registerInstance(JobWorker, jobWorker);
    const useCase = container.resolve(ImportProjectsUseCase);
    return { useCase, db, securityService, jobWorker };
}

describe("ImportProjectsUseCase", () => {
    const testDirs: string[] = [];

    afterEach(() => {
        for (const dir of testDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    function createTempProjectDir(name: string): string {
        const dir = join(
            tmpdir(),
            `import-project-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
        testDirs.push(dir);
        return dir;
    }

    it("imports new projects and triggers a security check plus a scan job for each", async () => {
        const { useCase, db, securityService, jobWorker } = setup();
        const pathA = createTempProjectDir("a");
        const pathB = createTempProjectDir("b");

        const result = await useCase.execute({ items: [{ path: pathA }, { path: pathB }] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.every(item => item.status === "added")).toBe(true);
        }
        expect(securityService.check).toHaveBeenCalledTimes(2);
        expect(jobWorker.enqueue).toHaveBeenCalledTimes(2);
        expect(db.select().from(projects).all()).toHaveLength(2);
    });

    it("skips paths that are already registered", async () => {
        const { useCase, db } = setup();
        const existingPath = createTempProjectDir("existing");
        db.insert(projects)
            .values({
                id: generateId(),
                name: "existing",
                path: existingPath,
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ items: [{ path: existingPath }] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items).toEqual([{ path: existingPath, status: "skipped" }]);
        }
    });

    it("marks an item as failed when registration throws", async () => {
        const { useCase } = setup();
        const duplicatePath = createTempProjectDir("duplicate");

        // Both items share the same, not-yet-registered path. The first one
        // succeeds and inserts a project row; the second then violates the
        // unique constraint on `projects.path`, causing registerProject to throw.
        const result = await useCase.execute({
            items: [{ path: duplicatePath }, { path: duplicatePath }]
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.items[0]!.status).toBe("added");
            expect(result.value.items[1]!.status).toBe("failed");
            expect(result.value.items[1]!.error).toBeTruthy();
        }
    });
});
