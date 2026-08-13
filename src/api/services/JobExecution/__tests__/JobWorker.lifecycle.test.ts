import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { Logger } from "@webiny/stdlib";
import { upgradeJobs } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import {
    setupJobWorkerTest,
    teardownJobWorkerTest,
    createProject,
    createScanCommandRunner,
    type JobWorkerTestContext,
    type TestDb
} from "./jobWorkerTestHelpers.js";

describe("JobWorker - lifecycle", () => {
    let ctx: JobWorkerTestContext;
    let testDir: string;
    let worker: JobWorker.Interface;
    let commandRunner: CommandRunner.Interface;
    let broadcaster: WebSocketBroadcaster.Interface;
    let logger: Logger.Interface;
    let db: TestDb;

    beforeEach(async () => {
        ctx = await setupJobWorkerTest();
        ({ testDir, worker, commandRunner, broadcaster, logger, db } = ctx);
    });

    afterEach(() => {
        teardownJobWorkerTest(ctx);
    });

    it("processes a pending dependency job to completion, invoking upgradeService per package", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [
                { name: "react", from: "18.0.0", to: "19.0.0" },
                { name: "react-dom", from: "18.0.0", to: "19.0.0" }
            ]
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(job!.startedAt).not.toBeNull();
        expect(job!.completedAt).not.toBeNull();
        expect(job!.logs).toContain("Processing...");
        expect(commandRunner.runStreaming).toHaveBeenCalledTimes(2);
    });

    it("processes a transient job via refreshTransient", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["up", "**", "-R"],
            expect.anything()
        );
    });

    it("processes a packageManager job via updateVersion", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" }
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["set", "version", "4.7.0"],
            expect.anything()
        );
    });

    it("marks a job as failed when execution throws", async () => {
        commandRunner.runStreaming = vi.fn(async () => {
            throw new Error("boom");
        });

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("failed");
        expect(job!.logs).toContain("ERROR");
        expect(job!.logs).toContain("boom");
    });

    it("runs two jobs for the same project concurrently (no per-project serialization)", async () => {
        const firstJobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        const secondJobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react-dom", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        const first = await worker.getJob(firstJobId);
        const second = await worker.getJob(secondJobId);
        expect(first!.status).toBe("running");
        expect(second!.status).toBe("running");

        await worker.drain();

        expect((await worker.getJob(firstJobId))!.status).toBe("completed");
        expect((await worker.getJob(secondJobId))!.status).toBe("completed");
    });

    it("runs jobs for different projects concurrently", async () => {
        await createProject({ db, id: "p2", path: join(testDir, "p2") });

        const jobOneId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        const jobTwoId = await worker.enqueue({
            referenceId: "p2",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react-dom", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        const jobOne = await worker.getJob(jobOneId);
        const jobTwo = await worker.getJob(jobTwoId);
        expect(jobOne!.status).toBe("running");
        expect(jobTwo!.status).toBe("running");

        await worker.drain();

        expect((await worker.getJob(jobOneId))!.status).toBe("completed");
        expect((await worker.getJob(jobTwoId))!.status).toBe("completed");
    });

    it("chains an auto-enqueued transient job after a dependency job with refreshTransient completes", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }],
            refreshTransient: true
        });

        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("completed");

        const jobsAfterDep = await worker.getJobsForReference("p1");
        const transientJob = jobsAfterDep.find(job => job.type === "transient");
        expect(transientJob).toBeDefined();
        expect(transientJob!.status).toBe("pending");
        expect(jobsAfterDep.filter(job => job.type === "scan")).toHaveLength(1);

        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(transientJob!.id))!.status).toBe("completed");
    });

    it("does not chain a transient job when refreshTransient is not set, but chains a scan", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(2);
        expect(jobs.find(job => job.type === "transient")).toBeUndefined();
        expect(jobs.find(job => job.type === "scan")).toBeDefined();
    });

    it("chains an auto-scan after a dependency job completes", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        const scanJob = jobs.find(job => job.type === "scan");
        expect(scanJob).toBeDefined();
        expect(scanJob!.status).toBe("pending");
    });

    it("chains an auto-scan after a transient job completes", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        const scanJob = jobs.find(job => job.type === "scan");
        expect(scanJob).toBeDefined();
        expect(scanJob!.status).toBe("pending");
    });

    it("does not chain a transient job when refreshTransient is set on a non-dependency job", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" },
            refreshTransient: true
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(1);
    });

    it("broadcasts job:status transitions for running and completed", async () => {
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });

        await worker.drain();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });
    });

    it("broadcasts job:log for each stdout/stderr line during execution", async () => {
        commandRunner.runStreaming = vi.fn(async (_cmd, _args, options) => {
            options?.onStdout?.("line 1");
            options?.onStdout?.("line 2");
            return { stdout: "", stderr: "", exitCode: 0 };
        });
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const logCalls = broadcastSpy.mock.calls.filter(([type]) => type === "job:log");
        expect(logCalls).toEqual([
            ["job:log", { jobId, referenceId: "p1", line: "line 1" }],
            ["job:log", { jobId, referenceId: "p1", line: "line 2" }],
            [
                "job:log",
                {
                    jobId,
                    referenceId: "p1",
                    line: "Auto-scan enqueued after dependency"
                }
            ]
        ]);
    });

    it("broadcasts job:status failed when a job fails", async () => {
        commandRunner.runStreaming = vi.fn(async () => {
            throw new Error("boom");
        });
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "failed"
        });
    });

    it("cancels a pending job without aborting a subprocess", async () => {
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.cancelJob(jobId);

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("cancelled");
        expect(job!.completedAt).not.toBeNull();
        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "cancelled"
        });
    });

    it("cancels a running job by aborting the subprocess", async () => {
        let resolveStreaming: (() => void) | undefined;
        commandRunner.runStreaming = vi.fn(
            () =>
                new Promise<CommandRunner.Result>(resolve => {
                    resolveStreaming = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
                })
        );

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        expect((await worker.getJob(jobId))!.status).toBe("running");

        await worker.cancelJob(jobId);
        resolveStreaming!();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("cancelled");
    });

    it("is a no-op when cancelling a completed job", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("completed");
        await worker.cancelJob(jobId);
        expect((await worker.getJob(jobId))!.status).toBe("completed");
    });

    it("logs an error when the progress DB write fails, without failing the job", async () => {
        const loggerErrorSpy = vi.spyOn(logger, "error");

        let updateCallCount = 0;
        const originalUpdate = db.update.bind(db);
        vi.spyOn(db, "update").mockImplementation(((table: typeof upgradeJobs) => {
            updateCallCount++;
            if (updateCallCount === 2) {
                return {
                    set: () => ({
                        where: () => ({
                            run: () => {
                                throw new Error("disk full");
                            }
                        })
                    })
                };
            }
            return originalUpdate(table);
        }) as typeof db.update);

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transitive-resolve"
        });

        await worker.processNextJob();
        await worker.drain();

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            "Failed to write job progress to database",
            expect.objectContaining({ error: expect.any(String) })
        );

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
    });

    it("logs an error when the periodic log flush write fails, without failing the job", async () => {
        vi.useFakeTimers();
        const loggerErrorSpy = vi.spyOn(logger, "error");

        let resolveStreaming: (() => void) | undefined;
        commandRunner.runStreaming = vi.fn((_cmd, _args, options) => {
            options?.onStdout?.("line 1");
            return new Promise<CommandRunner.Result>(resolve => {
                resolveStreaming = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
            });
        });

        let updateCallCount = 0;
        const originalUpdate = db.update.bind(db);
        vi.spyOn(db, "update").mockImplementation(((table: typeof upgradeJobs) => {
            updateCallCount++;
            if (updateCallCount === 2) {
                return {
                    set: () => ({
                        where: () => ({
                            run: () => {
                                throw new Error("disk full");
                            }
                        })
                    })
                };
            }
            return originalUpdate(table);
        }) as typeof db.update);

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await vi.advanceTimersByTimeAsync(2000);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
            "Failed to flush job logs to database",
            expect.objectContaining({ error: expect.any(String) })
        );

        resolveStreaming!();
        vi.useRealTimers();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
    });

    describe("scan jobs", () => {
        beforeEach(() => {
            writeFileSync(
                join(testDir, "p1", "package.json"),
                JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
            );
            commandRunner.run = createScanCommandRunner().run;
        });

        // "scan" is now a thin orchestrator (see ScanJobExecutor.ts) that
        // enqueues a "package-scan" child job and waits for it — it no
        // longer scans/persists anything itself. A single processNextJob()
        // + drain() pass can't drive that child job to completion here (only
        // a running server's setInterval polling loop does that), so the
        // "persists results" and "delete-then-insert" scenarios once covered
        // here now live in PackageScanJobExecutor.test.ts against the real
        // executor directly, and the orchestration behavior itself (chaining,
        // concurrency guard, warning composition) is covered in
        // ScanJobExecutor.test.ts against a mocked JobWorker.

        it("broadcasts scan:failed and marks the job failed when ScanService throws", async () => {
            commandRunner.run = vi.fn(async () => {
                throw new Error("registry unreachable");
            });
            const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                packages: JSON.stringify({})
            });

            await worker.processNextJob();
            await worker.drain();

            const job = await worker.getJob(jobId);
            expect(job!.status).toBe("failed");
            expect(job!.logs).toContain("ERROR");

            expect(broadcastSpy).toHaveBeenCalledWith(
                "scan:failed",
                expect.objectContaining({ projectId: "p1" })
            );
            expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
                jobId,
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "failed"
            });
        });
    });
});
