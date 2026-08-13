import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { upgradeJobs } from "#api/db/schema.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import {
    setupJobWorkerTest,
    teardownJobWorkerTest,
    type JobWorkerTestContext,
    type TestDb
} from "./jobWorkerTestHelpers.js";

describe("JobWorker - waiting", () => {
    let ctx: JobWorkerTestContext;
    let worker: JobWorker.Interface;
    let db: TestDb;

    beforeEach(async () => {
        ctx = await setupJobWorkerTest();
        ({ worker, db } = ctx);
    });

    afterEach(() => {
        teardownJobWorkerTest(ctx);
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
});
