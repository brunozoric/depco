import { and, eq, inArray } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { JobWorker as Abstraction } from "./abstractions/JobWorker.js";
import { PackageManagerService } from "./abstractions/PackageManagerService.js";
import { SecurityService } from "./abstractions/SecurityService.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobExecutorRegistry } from "./jobExecutors/abstractions/JobExecutorRegistry.js";
import type { ISetProgressInput } from "./jobExecutors/abstractions/JobExecutor.js";
import { ErrorReporter } from "./abstractions/ErrorReporter.js";
import { projects, upgradeJobs } from "#api/db/schema.js";

const PROGRESS_DB_WRITE_THROTTLE_MS = 1000;
const LOG_DB_FLUSH_INTERVAL_MS = 2000;
const JOB_WAIT_POLL_INTERVAL_MS = 200;
const TERMINAL_JOB_STATUSES = new Set<string>(["completed", "failed", "cancelled", "interrupted"]);

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

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly securityService: SecurityService.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly jobExecutorRegistry: JobExecutorRegistry.Interface,
        private readonly errorReporter: ErrorReporter.Interface
    ) {}

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

        let logs = "";
        let projectContext = "";
        let progressUsed = false;
        let lastProgressDbWriteAt = 0;
        let logsDirty = false;
        const flushLogs = (): void => {
            if (!logsDirty) {
                return;
            }
            logsDirty = false;
            try {
                this.databaseClient.db
                    .update(upgradeJobs)
                    .set({ logs })
                    .where(eq(upgradeJobs.id, job.id))
                    .run();
            } catch {}
        };
        const logFlushTimer = setInterval(flushLogs, LOG_DB_FLUSH_INTERVAL_MS);

        const appendLog = (line: string): void => {
            logs += `${line}\n`;
            logsDirty = true;
            this.webSocketBroadcaster.broadcast("job:log", {
                jobId: job.id,
                referenceId: job.referenceId,
                line
            });
        };

        const setProgress = (input: ISetProgressInput): void => {
            progressUsed = true;
            const progressLabel = input.label ?? null;

            this.webSocketBroadcaster.broadcast("job:progress", {
                jobId: job.id,
                referenceId: job.referenceId,
                progress: input.percent,
                progressLabel
            });

            const now = Date.now();
            if (
                input.percent >= 100 ||
                now - lastProgressDbWriteAt >= PROGRESS_DB_WRITE_THROTTLE_MS
            ) {
                lastProgressDbWriteAt = now;
                try {
                    this.databaseClient.db
                        .update(upgradeJobs)
                        .set({ progress: input.percent, progressLabel })
                        .where(eq(upgradeJobs.id, job.id))
                        .run();
                } catch {}
            }
        };

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
                    appendLog,
                    setProgress,
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
                    appendLog,
                    setProgress,
                    signal: controller.signal
                });
            }

            await this.chainRefreshTransientIfNeeded(job, appendLog);
            await this.chainScanAfterJobIfNeeded(job, appendLog);

            await this.finishJob({
                jobId: job.id,
                referenceId: job.referenceId,
                referenceType: job.referenceType,
                type: job.type,
                status: controller.signal.aborted ? "cancelled" : "completed",
                logs,
                progressUsed
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
                logs
            );

            await this.finishJob({
                jobId: job.id,
                referenceId: job.referenceId,
                referenceType: job.referenceType,
                type: job.type,
                status,
                logs: `${logs}\nERROR: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
                progressUsed
            });
        } finally {
            clearInterval(logFlushTimer);
            this.#controllers.delete(job.id);
        }
    }

    private async chainRefreshTransientIfNeeded(
        job: Abstraction.Job,
        appendLog: (line: string) => void
    ): Promise<void> {
        if (job.type !== "dependency" || !this.#refreshTransientJobIds.has(job.id)) {
            return;
        }

        this.#refreshTransientJobIds.delete(job.id);

        let packageNames: string | undefined;
        if (job.packages) {
            try {
                const parsed = JSON.parse(job.packages) as Array<{ name: string }>;
                const names = parsed.map(p => p.name);
                if (names.length > 0) {
                    packageNames = JSON.stringify(names);
                }
            } catch {
                // fall through — refresh all
            }
        }

        try {
            await this.enqueue({
                referenceId: job.referenceId,
                referenceType: "project",
                type: "transient",
                packages: packageNames,
                parentJobId: job.id
            });
        } catch (error) {
            appendLog(`Failed to enqueue transient refresh: ${String(error)}`);
        }
    }

    private async chainScanAfterJobIfNeeded(
        job: Abstraction.Job,
        appendLog: (line: string) => void
    ): Promise<void> {
        if (job.type !== "install" && job.type !== "dependency" && job.type !== "transient") {
            return;
        }

        try {
            await this.enqueue({
                referenceId: job.referenceId,
                referenceType: "project",
                type: "scan",
                parentJobId: job.id
            });
            appendLog(`Auto-scan enqueued after ${job.type}`);
        } catch (error) {
            appendLog(`Failed to enqueue auto-scan: ${String(error)}`);
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
        await Promise.all([...this.#inFlight]);
    }

    public async cancelJob(jobId: string): Promise<void> {
        const controller = this.#controllers.get(jobId);
        if (controller) {
            controller.abort();
            return;
        }

        const job = await this.getJob(jobId);
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
}

export const JobWorker = Abstraction.createImplementation({
    implementation: JobWorkerImpl,
    dependencies: [
        DatabaseClient,
        PackageManagerService,
        SecurityService,
        WebSocketBroadcaster,
        JobExecutorRegistry,
        ErrorReporter
    ]
});
