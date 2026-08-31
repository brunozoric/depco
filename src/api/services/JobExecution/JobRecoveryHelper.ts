import { eq, inArray } from "drizzle-orm";
import type { JobQueryHelper } from "./JobQueryHelper.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { upgradeJobs } from "#api/db/schema.js";

export interface IJobRecoveryHelperDeps {
    databaseClient: DatabaseClient.Interface;
    webSocketBroadcaster: WebSocketBroadcaster.Interface;
    jobQueryHelper: JobQueryHelper;
    controllers: Map<string, AbortController>;
    inFlight: Set<Promise<void>>;
}

/**
 * Startup recovery, graceful-drain, and cancellation for in-flight/pending
 * jobs. Internal helper for JobWorkerImpl — shares the controllers/inFlight
 * bookkeeping owned by the parent (passed by reference), not DI-registered.
 */
export class JobRecoveryHelper {
    private readonly databaseClient: DatabaseClient.Interface;
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface;
    private readonly jobQueryHelper: JobQueryHelper;
    private readonly controllers: Map<string, AbortController>;
    private readonly inFlight: Set<Promise<void>>;

    public constructor(deps: IJobRecoveryHelperDeps) {
        this.databaseClient = deps.databaseClient;
        this.webSocketBroadcaster = deps.webSocketBroadcaster;
        this.jobQueryHelper = deps.jobQueryHelper;
        this.controllers = deps.controllers;
        this.inFlight = deps.inFlight;
    }

    public async drain(): Promise<void> {
        await Promise.all(this.inFlight);
    }

    public async cancelJob(jobId: string): Promise<void> {
        const controller = this.controllers.get(jobId);
        if (controller) {
            controller.abort();
            return;
        }

        const job = await this.jobQueryHelper.getJob(jobId);
        if (!job || job.status !== "pending") {
            return;
        }

        await this.databaseClient.db
            .update(upgradeJobs)
            .set({ status: "cancelled", completedAt: Date.now() })
            .where(eq(upgradeJobs.id, jobId))
            .run();

        this.webSocketBroadcaster.broadcast("job:status", {
            jobId,
            referenceId: job.referenceId,
            referenceType: job.referenceType,
            type: job.type,
            status: "cancelled"
        });
    }

    public async recoverStaleJobs(): Promise<void> {
        await this.databaseClient.db
            .update(upgradeJobs)
            .set({
                status: "interrupted",
                completedAt: Date.now(),
                logs: "Job interrupted by server restart"
            })
            .where(inArray(upgradeJobs.status, ["running", "pending"]))
            .run();
    }
}
