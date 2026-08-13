import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { JobWorker as Abstraction } from "./abstractions/JobWorker.js";
import { JobExecutionContextFactory } from "./abstractions/JobExecutionContextFactory.js";
import { PackageManagerService } from "../PackageManager/index.js";
import { SecurityService } from "../Security/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobExecutorRegistry } from "./executors/abstractions/JobExecutorRegistry.js";
import { ErrorReporter } from "../ErrorReporter/index.js";
import { projects, upgradeJobs } from "#api/db/schema.js";
import { chainRefreshTransientIfNeeded, chainScanAfterJobIfNeeded } from "./JobChaining.js";
import { JobQueryHelper } from "./JobQueryHelper.js";
import { JobRecoveryHelper } from "./JobRecoveryHelper.js";

interface IFinishJobInput {
    jobId: string;
    referenceId: string;
    referenceType: string;
    type: string;
    status: "completed" | "failed" | "cancelled" | "interrupted";
    logs: string;
    progressUsed?: boolean;
}

class JobWorkerImpl implements Abstraction.Interface {
    readonly #refreshTransientJobIds = new Set<string>();
    readonly #controllers = new Map<string, AbortController>();
    readonly #inFlight = new Set<Promise<void>>();
    readonly #queryHelper: JobQueryHelper;
    readonly #recoveryHelper: JobRecoveryHelper;

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly securityService: SecurityService.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly jobExecutorRegistry: JobExecutorRegistry.Interface,
        private readonly errorReporter: ErrorReporter.Interface,
        private readonly executionContextFactory: JobExecutionContextFactory.Interface
    ) {
        this.#queryHelper = new JobQueryHelper(databaseClient);
        this.#recoveryHelper = new JobRecoveryHelper({
            databaseClient,
            webSocketBroadcaster,
            jobQueryHelper: this.#queryHelper,
            controllers: this.#controllers,
            inFlight: this.#inFlight
        });
    }

    public async enqueue(input: Abstraction.CreateJobInput): Promise<string> {
        if (input.type === "dependency" || input.type === "transient") {
            const project = await this.databaseClient.db
                .select()
                .from(projects)
                .where(eq(projects.id, input.referenceId))
                .get();

            if (!project) {
                throw new Error("Project not found");
            }

            const securityResult = await this.securityService.check(project.id, project.path);
            if (!securityResult.passes) {
                throw new Error("Security check failed");
            }
        }

        const id = generateId();
        await this.databaseClient.db
            .insert(upgradeJobs)
            .values({
                id,
                referenceId: input.referenceId,
                referenceType: input.referenceType,
                type: input.type,
                status: "pending",
                packages:
                    input.packages == null
                        ? null
                        : typeof input.packages === "string"
                          ? input.packages
                          : JSON.stringify(input.packages),
                parentJobId: input.parentJobId ?? null
            })
            .run();

        if (input.type === "dependency" && input.refreshTransient === true) {
            this.#refreshTransientJobIds.add(id);
        }

        return id;
    }

    public async getJob(jobId: string): Promise<Abstraction.Job | null> {
        return this.#queryHelper.getJob(jobId);
    }

    public async getJobsForReference(referenceId: string): Promise<Abstraction.Job[]> {
        return this.#queryHelper.getJobsForReference(referenceId);
    }

    public async processNextJob(): Promise<void> {
        const pendingJobs = await this.databaseClient.db
            .select()
            .from(upgradeJobs)
            .where(eq(upgradeJobs.status, "pending"))
            .all();

        for (const job of pendingJobs) {
            await this.databaseClient.db
                .update(upgradeJobs)
                .set({ status: "running", startedAt: Date.now() })
                .where(eq(upgradeJobs.id, job.id))
                .run();

            this.webSocketBroadcaster.broadcast("job:status", {
                jobId: job.id,
                referenceId: job.referenceId,
                referenceType: job.referenceType,
                type: job.type,
                status: "running"
            });

            const promise = this.executeJob(job)
                .catch(() => {})
                .finally(() => this.#inFlight.delete(promise));
            this.#inFlight.add(promise);
        }
    }

    private async executeJob(job: Abstraction.Job): Promise<void> {
        const controller = new AbortController();
        this.#controllers.set(job.id, controller);

        const context = this.executionContextFactory.create({
            jobId: job.id,
            referenceId: job.referenceId
        });

        let projectContext = "";

        try {
            const executor = this.jobExecutorRegistry.getExecutor(job.type);

            if (job.type === "clone" || job.type === "changelog") {
                projectContext = `${job.type} job ${job.id}`;
                await executor.execute({
                    jobId: job.id,
                    referenceId: job.referenceId,
                    projectPath: "",
                    packageManager: "",
                    packagesJson: job.packages,
                    project: null,
                    appendLog: context.appendLog,
                    setProgress: context.setProgress,
                    signal: controller.signal
                });
            } else {
                const project = await this.databaseClient.db
                    .select()
                    .from(projects)
                    .where(eq(projects.id, job.referenceId))
                    .get();

                if (!project) {
                    await this.finishJob({
                        jobId: job.id,
                        referenceId: job.referenceId,
                        referenceType: job.referenceType,
                        type: job.type,
                        status: "failed",
                        logs: "Project not found"
                    });
                    return;
                }

                projectContext = `${project.name} (${project.path})`;

                const packageManager =
                    project.packageManager ??
                    (await this.packageManagerService.detect(project.path));

                await executor.execute({
                    jobId: job.id,
                    referenceId: job.referenceId,
                    projectPath: project.path,
                    packageManager,
                    packagesJson: job.packages,
                    project: {
                        id: project.id,
                        name: project.name,
                        path: project.path,
                        packageManager: project.packageManager
                    },
                    appendLog: context.appendLog,
                    setProgress: context.setProgress,
                    signal: controller.signal
                });
            }

            const enqueue = this.enqueue.bind(this);
            await chainRefreshTransientIfNeeded(job, context.appendLog, {
                enqueue,
                isRefreshTransientFlagged: id => this.#refreshTransientJobIds.has(id),
                clearRefreshTransientFlag: id => this.#refreshTransientJobIds.delete(id)
            });
            await chainScanAfterJobIfNeeded(job, context.appendLog, enqueue);

            await this.finishJob({
                jobId: job.id,
                referenceId: job.referenceId,
                referenceType: job.referenceType,
                type: job.type,
                status: controller.signal.aborted ? "cancelled" : "completed",
                logs: context.getLogs(),
                progressUsed: context.wasProgressUsed()
            });
        } catch (error) {
            this.#refreshTransientJobIds.delete(job.id);

            const status = controller.signal.aborted ? "cancelled" : "failed";

            if (job.type === "scan" && status === "failed") {
                this.webSocketBroadcaster.broadcast("scan:failed", {
                    projectId: job.referenceId,
                    error: String(error)
                });
            }

            await this.errorReporter.reportJobFailure(
                job.id,
                job.type,
                job.referenceId,
                projectContext,
                error,
                context.getLogs()
            );

            await this.finishJob({
                jobId: job.id,
                referenceId: job.referenceId,
                referenceType: job.referenceType,
                type: job.type,
                status,
                logs: `${context.getLogs()}\nERROR: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
                progressUsed: context.wasProgressUsed()
            });
        } finally {
            context.dispose();
            this.#controllers.delete(job.id);
        }
    }

    private async finishJob(input: IFinishJobInput): Promise<void> {
        const { jobId, referenceId, referenceType, type, status, logs, progressUsed } = input;

        const updateFields: Record<string, unknown> = {
            status,
            completedAt: Date.now(),
            logs
        };
        if (progressUsed) {
            updateFields["progress"] = 100;
            updateFields["progressLabel"] = null;
        }

        await this.databaseClient.db
            .update(upgradeJobs)
            .set(updateFields)
            .where(eq(upgradeJobs.id, jobId))
            .run();

        this.webSocketBroadcaster.broadcast("job:status", {
            jobId,
            referenceId,
            referenceType,
            type,
            status
        });
    }

    public async drain(): Promise<void> {
        await this.#recoveryHelper.drain();
    }

    public async cancelJob(jobId: string): Promise<void> {
        await this.#recoveryHelper.cancelJob(jobId);
    }

    public async listAllJobs(status?: string): Promise<Abstraction.Job[]> {
        return this.#queryHelper.listAllJobs(status);
    }

    public async recoverStaleJobs(): Promise<void> {
        await this.#recoveryHelper.recoverStaleJobs();
    }

    public async waitForJob(input: Abstraction.WaitForJobInput): Promise<Abstraction.Job> {
        return this.#queryHelper.waitForJob(input);
    }

    public async waitForJobs(input: Abstraction.WaitForJobsInput): Promise<Abstraction.Job[]> {
        return this.#queryHelper.waitForJobs(input);
    }

    public async getRunningJobsForReference(
        input: Abstraction.GetRunningJobsForReferenceInput
    ): Promise<Abstraction.Job[]> {
        return this.#queryHelper.getRunningJobsForReference(input);
    }
}

export const JobWorker = Abstraction.createImplementation({
    implementation: JobWorkerImpl,
    dependencies: [
        DatabaseClient,
        PackageManagerService,
        SecurityService,
        WebSocketBroadcaster,
        JobExecutorRegistry,
        ErrorReporter,
        JobExecutionContextFactory
    ]
});
