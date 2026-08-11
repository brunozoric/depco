import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { Logger } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { projects, upgradeJobs } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { LockfileParserService } from "../../DependencyGraph/index.js";
import { ErrorReporter } from "../../ErrorReporter/index.js";
import { ScanSchedulerService } from "../../ScanScheduler/index.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

// CommandRunner double that can also drive a scan: resolves workspace
// listing, installed-version collection, and registry lookups so
// ScanService produces a real (non-empty) result set.
function createScanCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout: '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n',
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "1.4.0" },
                        versions: ["1.3.0", "1.4.0"],
                        time: {
                            "1.3.0": "2020-01-01T00:00:00.000Z",
                            "1.4.0": "2020-06-01T00:00:00.000Z"
                        },
                        repository: {
                            type: "git",
                            url: "git+https://github.com/left-pad/left-pad.git"
                        },
                        readme: "# left-pad"
                    }),
                    stderr: "",
                    exitCode: 0
                };
            }
            return { stdout: "", stderr: "", exitCode: 0 };
        }),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

async function createProject(db: TestDb, id: string, path: string): Promise<void> {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, ".yarnrc.yml"), VALID_YARNRC);
    await db
        .insert(projects)
        .values({ id, name: id, path, packageManager: "yarn", addedAt: Date.now() })
        .run();
}

describe("JobWorker", () => {
    let testDir: string;
    let worker: JobWorker.Interface;
    let commandRunner: CommandRunner.Interface;
    let broadcaster: WebSocketBroadcaster.Interface;
    let logger: Logger.Interface;
    let db: TestDb;

    beforeEach(async () => {
        testDir = join(tmpdir(), `worker-test-${Date.now()}-${Math.random()}`);

        const { container, db: testDb } = createTestApiContainer();
        db = testDb;

        commandRunner = createMockCommandRunner();
        container.registerInstance(CommandRunner, commandRunner);
        container.registerInstance(LockfileParserService, {
            parse: vi.fn(async () => [
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "left-pad",
                    childVersion: "1.3.0",
                    dependencyType: "dependency",
                    depth: 0
                }
            ])
        });
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        container.registerInstance(ScanSchedulerService, {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        });

        await seedYarnSecuritySettings(db);
        await createProject(db, "p1", join(testDir, "p1"));

        worker = container.resolve(JobWorker);
        broadcaster = container.resolve(WebSocketBroadcaster);
        logger = container.resolve(Logger);
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("enqueues a dependency upgrade job as pending", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        const job = await worker.getJob(jobId);
        expect(job).toBeDefined();
        expect(job!.status).toBe("pending");
        expect(job!.type).toBe("dependency");
    });

    it("rejects a dependency job when the security check fails", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        await expect(
            worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            })
        ).rejects.toThrow("Security check failed");
    });

    it("rejects a transient job when the security check fails", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        await expect(
            worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            })
        ).rejects.toThrow("Security check failed");
    });

    it("allows a packageManager job without a security check", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" }
        });

        expect(jobId).toBeDefined();
    });

    it("throws when enqueuing for a project that does not exist", async () => {
        await expect(
            worker.enqueue({
                referenceId: "does-not-exist",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            })
        ).rejects.toThrow("Project not found");
    });

    it("retrieves jobs for a project", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(1);
    });

    it("returns null for a job that does not exist", async () => {
        const job = await worker.getJob("does-not-exist");
        expect(job).toBeNull();
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
        await createProject(db, "p2", join(testDir, "p2"));

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

    it("lists all jobs across all projects", async () => {
        await createProject(db, "p2", join(testDir, "p2"));
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.enqueue({
            referenceId: "p2",
            referenceType: "project",
            type: "transient"
        });

        const all = await worker.listAllJobs();
        expect(all).toHaveLength(2);
    });

    it("lists jobs filtered by status", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.processNextJob();
        await worker.drain();

        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        const completed = await worker.listAllJobs("completed");
        expect(completed).toHaveLength(1);
        expect(completed[0]!.status).toBe("completed");

        const pending = await worker.listAllJobs("pending");
        expect(pending).toHaveLength(2);
        expect(pending.every(j => j.status === "pending")).toBe(true);
    });

    it("recovers stale running and pending jobs as interrupted on server restart", async () => {
        await db
            .insert(upgradeJobs)
            .values([
                {
                    id: "job-running",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "dependency",
                    status: "running"
                },
                {
                    id: "job-pending",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "dependency",
                    status: "pending"
                }
            ])
            .run();

        await worker.recoverStaleJobs();

        const runningJob = await worker.getJob("job-running");
        const pendingJob = await worker.getJob("job-pending");
        expect(runningJob!.status).toBe("interrupted");
        expect(runningJob!.logs).toBe("Job interrupted by server restart");
        expect(pendingJob!.status).toBe("interrupted");
        expect(pendingJob!.logs).toBe("Job interrupted by server restart");
    });

    describe("waitForJob", () => {
        it("resolves when the job reaches a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "completed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, jobId))
                    .run();
            }, 50);

            const result = await worker.waitForJob({ jobId });

            expect(result.status).toBe("completed");
            expect(result.id).toBe(jobId);
        });

        it("throws when the signal is aborted before the job reaches a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 50);

            await expect(worker.waitForJob({ jobId, signal: controller.signal })).rejects.toThrow();
        });

        it("throws when the job does not exist", async () => {
            await expect(worker.waitForJob({ jobId: "does-not-exist" })).rejects.toThrow(
                "Job not found"
            );
        });

        it("resolves immediately when the job is already in a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            });
            await worker.processNextJob();
            await worker.drain();

            const result = await worker.waitForJob({ jobId });
            expect(result.status).toBe("completed");
        });
    });

    describe("waitForJobs", () => {
        it("resolves once all jobs reach a terminal state", async () => {
            const firstJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const secondJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "completed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, firstJobId))
                    .run();
            }, 50);
            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "failed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, secondJobId))
                    .run();
            }, 100);

            const results = await worker.waitForJobs({ jobIds: [firstJobId, secondJobId] });

            expect(results).toHaveLength(2);
            expect(results.find(job => job.id === firstJobId)?.status).toBe("completed");
            expect(results.find(job => job.id === secondJobId)?.status).toBe("failed");
        });

        it("throws when the signal is aborted before all jobs reach a terminal state", async () => {
            const firstJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const secondJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 50);

            await expect(
                worker.waitForJobs({
                    jobIds: [firstJobId, secondJobId],
                    signal: controller.signal
                })
            ).rejects.toThrow();
        });
    });

    describe("getRunningJobsForReference", () => {
        it("returns only running jobs matching the referenceId and type", async () => {
            const runningJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const pendingJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const differentTypeJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            });

            await db
                .update(upgradeJobs)
                .set({ status: "running", startedAt: Date.now() })
                .where(eq(upgradeJobs.id, runningJobId))
                .run();
            await db
                .update(upgradeJobs)
                .set({ status: "running", startedAt: Date.now() })
                .where(eq(upgradeJobs.id, differentTypeJobId))
                .run();

            const running = await worker.getRunningJobsForReference({
                referenceId: "p1",
                type: "scan"
            });

            expect(running).toHaveLength(1);
            expect(running[0]?.id).toBe(runningJobId);
            expect(running.some(job => job.id === pendingJobId)).toBe(false);
            expect(running.some(job => job.id === differentTypeJobId)).toBe(false);
        });

        it("returns an empty array when no jobs are running for the reference", async () => {
            await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const running = await worker.getRunningJobsForReference({
                referenceId: "p1",
                type: "scan"
            });

            expect(running).toHaveLength(0);
        });
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
