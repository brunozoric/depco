import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { EventBus } from "../../../EventBus/index.js";
import { JobWorker } from "../../abstractions/JobWorker.js";
import { JobWorkerProvider } from "../../abstractions/JobWorkerProvider.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../../PackageManager/PackageManagerDriverRegistry.js";
import { projects, scanResults } from "#api/db/schema.js";
import { generateId } from "@webiny/stdlib";
import { ScanJobExecutor } from "../abstractions/ScanJobExecutor.js";
import { ScanJobExecutor as ScanJobExecutorRegistration } from "../ScanJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

interface IMakeJobOverrides {
    id?: string;
    type?: string;
    status?: string;
    warning?: string | null;
}

interface IInsertScanResultInput {
    registryResolved: number;
}

function makeJob(overrides: IMakeJobOverrides = {}): JobWorker.Job {
    return {
        id: overrides.id ?? "job-child",
        referenceId: "project-1",
        referenceType: "project",
        type: overrides.type ?? "package-scan",
        status: overrides.status ?? "completed",
        packages: null,
        logs: null,
        startedAt: Date.now(),
        completedAt: Date.now(),
        warning: overrides.warning ?? null,
        progress: null,
        progressLabel: null,
        parentJobId: "job-1"
    };
}

function createMockJobWorker(): JobWorker.Interface {
    let enqueueCounter = 0;
    return {
        enqueue: vi.fn(async () => `job-child-${++enqueueCounter}`),
        getJob: vi.fn(async () => null),
        getJobsForReference: vi.fn(async () => []),
        processNextJob: vi.fn(async () => {}),
        cancelJob: vi.fn(async () => {}),
        listAllJobs: vi.fn(async () => []),
        drain: vi.fn(async () => {}),
        recoverStaleJobs: vi.fn(async () => {}),
        waitForJob: vi.fn(async () => makeJob()),
        waitForJobs: vi.fn(async () => []),
        getRunningJobsForReference: vi.fn(async () => [])
    };
}

describe("ScanJobExecutor", () => {
    let testDir: string;
    let db: Awaited<ReturnType<typeof createTestDb>>;
    let broadcaster: WebSocketBroadcaster.Interface;
    let eventBus: EventBus.Interface;
    let jobWorker: JobWorker.Interface;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `scan-orchestrator-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        db = await createTestDb();
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };
        eventBus = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn()
        };
        jobWorker = createMockJobWorker();
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function createExecutor(): ScanJobExecutor.Interface {
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.registerInstance(EventBus, eventBus);
        container.registerFactory(JobWorkerProvider, () => ({
            get: () => jobWorker
        }));
        container.register(ScanJobExecutorRegistration);
        return container.resolve(ScanJobExecutor);
    }

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "project-1",
            projectPath: testDir,
            packageManager: "yarn",
            packagesJson: "{}",
            project: null,
            appendLog: vi.fn(),
            setProgress: vi.fn(),
            signal: new AbortController().signal,
            ...overrides
        };
    }

    function writeLockfile(): void {
        writeFileSync(join(testDir, "yarn.lock"), "");
    }

    async function insertProject(): Promise<void> {
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "p1",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
    }

    async function insertScanResult(input: IInsertScanResultInput): Promise<void> {
        await db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId: "project-1",
                name: "left-pad",
                currentVersion: "1.0.0",
                latestVersion: "1.0.0",
                latestInRange: "1.0.0",
                type: "dependencies",
                upgradeType: "none",
                dependencyKind: "transitive",
                registryResolved: input.registryResolved,
                scannedAt: Date.now()
            })
            .run();
    }

    it("throws and broadcasts scan:failed when the lockfile is missing", async () => {
        // No yarn.lock written.
        const executor = createExecutor();

        await expect(executor.execute(makeContext())).rejects.toThrow();

        expect(jobWorker.enqueue).not.toHaveBeenCalled();
        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        expect(broadcastSpy).toHaveBeenCalledWith(
            "scan:failed",
            expect.objectContaining({ projectId: "project-1" })
        );
    });

    it("throws 'Scan already running' when another scan job is already running for the project", async () => {
        writeLockfile();
        (jobWorker.getRunningJobsForReference as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ id: "other-scan-job", type: "scan", status: "running" })
        ]);
        const executor = createExecutor();

        await expect(executor.execute(makeContext())).rejects.toThrow(/Scan already running/);
        expect(jobWorker.enqueue).not.toHaveBeenCalled();
    });

    it("does not treat itself as a concurrent scan", async () => {
        writeLockfile();
        (jobWorker.getRunningJobsForReference as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ id: "job-1", type: "scan", status: "running" })
        ]);
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed" })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan" }),
            makeJob({ type: "license-scan" }),
            makeJob({ type: "graph-refresh" }),
            makeJob({ type: "engine-scan" })
        ]);
        const executor = createExecutor();

        await expect(executor.execute(makeContext())).resolves.toBeUndefined();
    });

    it("enqueues package-scan first and waits for it before enqueuing parallel children", async () => {
        writeLockfile();
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed", warning: null })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan" }),
            makeJob({ type: "license-scan" }),
            makeJob({ type: "graph-refresh" }),
            makeJob({ type: "engine-scan" })
        ]);
        const executor = createExecutor();

        await executor.execute(makeContext({ packagesJson: '{"force":true}' }));

        const enqueueSpy = jobWorker.enqueue as ReturnType<typeof vi.fn>;
        expect(enqueueSpy).toHaveBeenCalledTimes(5);
        expect(enqueueSpy.mock.calls[0]![0]).toEqual(
            expect.objectContaining({
                referenceId: "project-1",
                referenceType: "project",
                type: "package-scan",
                packages: '{"force":true}',
                parentJobId: "job-1"
            })
        );

        const waitForJobSpy = jobWorker.waitForJob as ReturnType<typeof vi.fn>;
        expect(waitForJobSpy).toHaveBeenCalledWith(
            expect.objectContaining({ jobId: "job-child-1" })
        );

        const parallelTypes = enqueueSpy.mock.calls
            .slice(1)
            .map(call => (call[0] as { type: string }).type);
        expect(parallelTypes.sort()).toEqual([
            "engine-scan",
            "graph-refresh",
            "license-scan",
            "vulnerability-scan"
        ]);

        const waitForJobsSpy = jobWorker.waitForJobs as ReturnType<typeof vi.fn>;
        expect(waitForJobsSpy).toHaveBeenCalledTimes(1);
    });

    it("throws and does not enqueue parallel children when package-scan fails", async () => {
        writeLockfile();
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "failed" })
        );
        const executor = createExecutor();

        await expect(executor.execute(makeContext())).rejects.toThrow();

        const enqueueSpy = jobWorker.enqueue as ReturnType<typeof vi.fn>;
        expect(enqueueSpy).toHaveBeenCalledTimes(1);
        expect(jobWorker.waitForJobs).not.toHaveBeenCalled();
        expect(jobWorker.cancelJob).toHaveBeenCalledWith("job-child-1");

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        expect(broadcastSpy).toHaveBeenCalledWith("scan:failed", expect.objectContaining({}));
    });

    it("completes with a warning listing failed child types when a parallel child fails", async () => {
        writeLockfile();
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed", warning: null })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan", status: "completed" }),
            makeJob({ type: "license-scan", status: "failed" }),
            makeJob({ type: "graph-refresh", status: "completed" }),
            makeJob({ type: "engine-scan", status: "completed" })
        ]);
        const executor = createExecutor();

        await executor.execute(makeContext());

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        const completeCall = broadcastSpy.mock.calls.find(call => call[0] === "scan:complete");
        expect(completeCall).toBeDefined();
        expect(completeCall![1]).toEqual(
            expect.objectContaining({
                projectId: "project-1",
                warning: expect.stringContaining("license-scan")
            })
        );
    });

    it("cancels all enqueued children when the wait is aborted", async () => {
        writeLockfile();
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed" })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error("Job wait aborted")
        );
        const executor = createExecutor();

        await expect(executor.execute(makeContext())).rejects.toThrow(/aborted/);

        const cancelSpy = jobWorker.cancelJob as ReturnType<typeof vi.fn>;
        // package-scan + 4 parallel children
        expect(cancelSpy).toHaveBeenCalledTimes(5);
        expect(cancelSpy).toHaveBeenCalledWith("job-child-1");

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        expect(broadcastSpy).toHaveBeenCalledWith("scan:failed", expect.objectContaining({}));
    });

    it("broadcasts scan:complete with the package-scan warning when no children fail", async () => {
        writeLockfile();
        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({
                id: "job-child-1",
                type: "package-scan",
                status: "completed",
                warning: "Lockfile may be stale — 0 dependencies found."
            })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan" }),
            makeJob({ type: "license-scan" }),
            makeJob({ type: "graph-refresh" }),
            makeJob({ type: "engine-scan" })
        ]);
        const executor = createExecutor();

        await executor.execute(makeContext());

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        expect(broadcastSpy).toHaveBeenCalledWith(
            "scan:complete",
            expect.objectContaining({
                projectId: "project-1",
                warning: "Lockfile may be stale — 0 dependencies found."
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith("scan:completed", "project-1");
    });

    it("enqueues transitive-resolve when there are unresolved transitive dependencies", async () => {
        writeLockfile();
        await insertProject();
        await insertScanResult({ registryResolved: 0 });

        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed" })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan" }),
            makeJob({ type: "license-scan" }),
            makeJob({ type: "graph-refresh" }),
            makeJob({ type: "engine-scan" }),
            makeJob({ type: "transitive-resolve" })
        ]);
        const executor = createExecutor();

        await executor.execute(makeContext());

        const enqueueSpy = jobWorker.enqueue as ReturnType<typeof vi.fn>;
        expect(enqueueSpy).toHaveBeenCalledTimes(6);
        const types = enqueueSpy.mock.calls.map(call => (call[0] as { type: string }).type);
        expect(types).toContain("transitive-resolve");

        const waitForJobsSpy = jobWorker.waitForJobs as ReturnType<typeof vi.fn>;
        expect((waitForJobsSpy.mock.calls[0]![0] as { jobIds: string[] }).jobIds).toHaveLength(5);
    });

    it("does not enqueue transitive-resolve when all transitives are resolved", async () => {
        writeLockfile();
        await insertProject();
        await insertScanResult({ registryResolved: 1 });

        (jobWorker.waitForJob as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeJob({ id: "job-child-1", type: "package-scan", status: "completed" })
        );
        (jobWorker.waitForJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeJob({ type: "vulnerability-scan" }),
            makeJob({ type: "license-scan" }),
            makeJob({ type: "graph-refresh" }),
            makeJob({ type: "engine-scan" })
        ]);
        const executor = createExecutor();

        await executor.execute(makeContext());

        const enqueueSpy = jobWorker.enqueue as ReturnType<typeof vi.fn>;
        expect(enqueueSpy).toHaveBeenCalledTimes(5);
        const types = enqueueSpy.mock.calls.map(call => (call[0] as { type: string }).type);
        expect(types).not.toContain("transitive-resolve");
    });
});
