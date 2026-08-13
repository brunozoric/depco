import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { upgradeJobs } from "#api/db/schema.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import {
    setupJobWorkerTest,
    teardownJobWorkerTest,
    createProject,
    type JobWorkerTestContext,
    type TestDb
} from "./jobWorkerTestHelpers.js";

describe("JobWorker - enqueue", () => {
    let ctx: JobWorkerTestContext;
    let testDir: string;
    let worker: JobWorker.Interface;
    let db: TestDb;

    beforeEach(async () => {
        ctx = await setupJobWorkerTest();
        ({ testDir, worker, db } = ctx);
    });

    afterEach(() => {
        teardownJobWorkerTest(ctx);
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

    it("lists all jobs across all projects", async () => {
        await createProject({ db, id: "p2", path: join(testDir, "p2") });
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
});
