import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { upgradeJobs } from "#api/db/schema.js";
import type { JobWorker } from "#api/services/JobExecution/index.js";
import { enqueueChangelogIfNeeded } from "../changelogEnqueue.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

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

function insertUpgradeJob(
    db: TestDb,
    overrides: Partial<typeof upgradeJobs.$inferInsert> = {}
): void {
    db.insert(upgradeJobs)
        .values({
            id: generateId(),
            referenceId: "left-pad",
            referenceType: "package",
            type: "changelog",
            status: "pending",
            packages: null,
            ...overrides
        })
        .run();
}

describe("enqueueChangelogIfNeeded", () => {
    it("enqueues a new changelog job when no active job exists for the package", async () => {
        const { db } = createTestApiContainer();
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: "left-pad",
            referenceType: "package",
            type: "changelog",
            packages: JSON.stringify({ packageName: "left-pad", from: "1.0.0", to: "1.2.0" })
        });
    });

    it("enqueues a new job when the only existing job for the package is inactive", async () => {
        const { db } = createTestApiContainer();
        insertUpgradeJob(db, { status: "completed" });
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(jobWorker.enqueue).toHaveBeenCalledTimes(1);
    });

    it("does nothing when an active job exists with no packages recorded yet", async () => {
        const { db } = createTestApiContainer();
        insertUpgradeJob(db, { status: "running", packages: null });
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(jobWorker.enqueue).not.toHaveBeenCalled();
    });

    it("does nothing when the active job already covers the requested range", async () => {
        const { db } = createTestApiContainer();
        insertUpgradeJob(db, {
            status: "pending",
            packages: JSON.stringify({ packageName: "left-pad", from: "1.0.0", to: "1.5.0" })
        });
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(jobWorker.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues a supplementary job for the uncovered gap when the range extends beyond the active job", async () => {
        const { db } = createTestApiContainer();
        insertUpgradeJob(db, {
            status: "pending",
            packages: JSON.stringify({ packageName: "left-pad", from: "1.0.0", to: "1.2.0" })
        });
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.5.0"
        });

        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: "left-pad",
            referenceType: "package",
            type: "changelog",
            packages: JSON.stringify({ packageName: "left-pad", from: "1.2.0", to: "1.5.0" })
        });
    });

    it("falls back to enqueuing the full range when the active job's packages are malformed", async () => {
        const { db } = createTestApiContainer();
        insertUpgradeJob(db, { status: "pending", packages: "{not-valid-json" });
        const jobWorker = createJobWorkerStub();

        await enqueueChangelogIfNeeded({
            deps: { db, jobWorker },
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.5.0"
        });

        expect(jobWorker.enqueue).toHaveBeenCalledWith({
            referenceId: "left-pad",
            referenceType: "package",
            type: "changelog",
            packages: JSON.stringify({ packageName: "left-pad", from: "1.0.0", to: "1.5.0" })
        });
    });
});
