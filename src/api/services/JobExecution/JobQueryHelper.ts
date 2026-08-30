import { and, eq } from "drizzle-orm";
import type { JobWorker as Abstraction } from "./abstractions/JobWorker.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { upgradeJobs } from "#api/db/schema.js";

const JOB_WAIT_POLL_INTERVAL_MS = 200;
import { TERMINAL_JOB_STATUSES } from "#shared/jobs/index.js";

/**
 * Read-side job lookups (single job, by-reference lists, running jobs) plus
 * poll-based wait helpers built on top of `getJob`. Internal helper for
 * JobWorkerImpl — not DI-registered, has no abstraction of its own.
 */
export class JobQueryHelper {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async getJob(jobId: string): Promise<Abstraction.Job | null> {
        const job = await this.databaseClient.db
            .select()
            .from(upgradeJobs)
            .where(eq(upgradeJobs.id, jobId))
            .get();

        return job ?? null;
    }

    public async getJobsForReference(referenceId: string): Promise<Abstraction.Job[]> {
        return this.databaseClient.db
            .select()
            .from(upgradeJobs)
            .where(eq(upgradeJobs.referenceId, referenceId))
            .all();
    }

    public async listAllJobs(status?: string): Promise<Abstraction.Job[]> {
        if (status !== undefined) {
            return this.databaseClient.db
                .select()
                .from(upgradeJobs)
                .where(eq(upgradeJobs.status, status))
                .all();
        }

        return this.databaseClient.db.select().from(upgradeJobs).all();
    }

    public async getRunningJobsForReference(
        input: Abstraction.GetRunningJobsForReferenceInput
    ): Promise<Abstraction.Job[]> {
        return this.databaseClient.db
            .select()
            .from(upgradeJobs)
            .where(
                and(
                    eq(upgradeJobs.referenceId, input.referenceId),
                    eq(upgradeJobs.type, input.type),
                    eq(upgradeJobs.status, "running")
                )
            )
            .all();
    }

    public async waitForJob(input: Abstraction.WaitForJobInput): Promise<Abstraction.Job> {
        const { jobId, signal } = input;

        while (true) {
            if (signal?.aborted) {
                throw new Error("Job wait aborted");
            }

            const job = await this.getJob(jobId);
            if (!job) {
                throw new Error(`Job not found: ${jobId}`);
            }

            if (TERMINAL_JOB_STATUSES.has(job.status)) {
                return job;
            }

            await new Promise<void>((resolve, reject) => {
                let onAbort: (() => void) | undefined;
                const timer = setTimeout(() => {
                    if (signal && onAbort) {
                        signal.removeEventListener("abort", onAbort);
                    }
                    resolve();
                }, JOB_WAIT_POLL_INTERVAL_MS);
                if (signal) {
                    onAbort = (): void => {
                        clearTimeout(timer);
                        reject(new Error("Job wait aborted"));
                    };
                    signal.addEventListener("abort", onAbort, { once: true });
                }
            });
        }
    }

    public async waitForJobs(input: Abstraction.WaitForJobsInput): Promise<Abstraction.Job[]> {
        const { jobIds, signal } = input;
        return Promise.all(jobIds.map(jobId => this.waitForJob({ jobId, signal })));
    }
}
