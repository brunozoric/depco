import { existsSync } from "fs";
import { join } from "path";
import { and, eq, lt, sql } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { ScanJobExecutor as Abstraction } from "./abstractions/ScanJobExecutor.js";
import { JobWorkerProvider } from "../abstractions/JobWorkerProvider.js";
import { PackageManagerDriverRegistry } from "../packageManagers/abstractions/PackageManagerDriverRegistry.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { EventBus } from "../abstractions/EventBus.js";
import { appSettings, scanResults } from "#api/db/schema.js";

declare module "../abstractions/EventBus.js" {
    interface IEventMap {
        "scan:completed": [projectId: string];
    }
}

const PARALLEL_CHILD_TYPES = ["vulnerability-scan", "license-scan", "graph-refresh"] as const;

const DEFAULT_TRANSITIVE_RESOLVE_TTL_HOURS = 24;

export interface IMarkStaleTransitiveDepsUnresolvedInput {
    referenceId: string;
    appendLog: (line: string) => void;
}

class ScanJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "scan" as const;

    public constructor(
        private readonly jobWorkerProvider: JobWorkerProvider.Interface,
        private readonly packageManagerDriverRegistry: PackageManagerDriverRegistry.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly eventBus: EventBus.Interface,
        private readonly databaseClient: DatabaseClient.Interface
    ) {}

    private async countUnresolvedTransitives(referenceId: string): Promise<number> {
        const row = await this.databaseClient.db
            .select({ count: sql<number>`count(*)` })
            .from(scanResults)
            .where(and(eq(scanResults.projectId, referenceId), eq(scanResults.registryResolved, 0)))
            .get();

        return row?.count ?? 0;
    }

    private async markStaleTransitiveDepsUnresolved(
        input: IMarkStaleTransitiveDepsUnresolvedInput
    ): Promise<void> {
        const { referenceId, appendLog } = input;

        const ttlSetting = await this.databaseClient.db
            .select({ value: appSettings.value })
            .from(appSettings)
            .where(eq(appSettings.key, "transitive-resolve-ttl"))
            .get();

        const parsed = ttlSetting
            ? parseInt(ttlSetting.value, 10)
            : DEFAULT_TRANSITIVE_RESOLVE_TTL_HOURS;
        const ttlHours = isNaN(parsed) ? DEFAULT_TRANSITIVE_RESOLVE_TTL_HOURS : parsed;

        if (ttlHours <= 0) {
            return;
        }

        const cutoff = Date.now() - ttlHours * 3600 * 1000;
        const staleResult = await this.databaseClient.db
            .update(scanResults)
            .set({ registryResolved: 0 })
            .where(
                and(
                    eq(scanResults.projectId, referenceId),
                    eq(scanResults.dependencyKind, "transitive"),
                    eq(scanResults.registryResolved, 1),
                    lt(scanResults.scannedAt, cutoff)
                )
            )
            .run();

        if (staleResult.rowsAffected > 0) {
            appendLog(
                `Marked ${staleResult.rowsAffected} stale transitive deps for re-resolution (TTL: ${ttlHours}h).`
            );
        }
    }

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const {
            jobId,
            referenceId,
            projectPath,
            packageManager,
            packagesJson,
            signal,
            appendLog,
            setProgress
        } = context;
        const jobWorker = this.jobWorkerProvider.get();
        const enqueuedChildJobIds: string[] = [];

        try {
            const runningScans = await jobWorker.getRunningJobsForReference({
                referenceId,
                type: "scan"
            });
            if (runningScans.some(job => job.id !== jobId)) {
                throw new Error("Scan already running for this project");
            }

            const driver = this.packageManagerDriverRegistry.getDriver(packageManager);
            if (!existsSync(join(projectPath, driver.lockfileName))) {
                throw new Error(`Lockfile not found: ${driver.lockfileName}`);
            }

            appendLog(`Starting scan for project ${referenceId}`);
            setProgress({ percent: 0, label: "Scanning packages..." });

            const packageScanId = await jobWorker.enqueue({
                referenceId,
                referenceType: "project",
                type: "package-scan",
                packages: packagesJson,
                parentJobId: jobId
            });
            enqueuedChildJobIds.push(packageScanId);

            appendLog("Waiting for package scan to complete...");
            const packageScanJob = await jobWorker.waitForJob({ jobId: packageScanId, signal });

            if (packageScanJob.status !== "completed") {
                throw new Error(`Package scan did not complete (status: ${packageScanJob.status})`);
            }

            appendLog("Package scan complete. Starting vulnerability, license and graph scans...");
            setProgress({
                percent: 40,
                label: "Running vulnerability, license and graph scans..."
            });

            const parallelJobIds: string[] = [];
            for (const type of PARALLEL_CHILD_TYPES) {
                const childJobId = await jobWorker.enqueue({
                    referenceId,
                    referenceType: "project",
                    type,
                    parentJobId: jobId
                });
                parallelJobIds.push(childJobId);
                enqueuedChildJobIds.push(childJobId);
            }

            const unresolvedCount = await this.countUnresolvedTransitives(referenceId);
            if (unresolvedCount > 0) {
                await this.markStaleTransitiveDepsUnresolved({ referenceId, appendLog });
                appendLog(
                    `Enqueuing transitive registry resolution for ${unresolvedCount} packages...`
                );
                const transitiveResolveId = await jobWorker.enqueue({
                    referenceId,
                    referenceType: "project",
                    type: "transitive-resolve",
                    parentJobId: jobId
                });
                parallelJobIds.push(transitiveResolveId);
                enqueuedChildJobIds.push(transitiveResolveId);
            }

            const parallelJobs = await jobWorker.waitForJobs({ jobIds: parallelJobIds, signal });

            const failedTypes = parallelJobs
                .filter(job => job.status !== "completed")
                .map(job => job.type);

            const warning =
                failedTypes.length > 0
                    ? `Some scans failed: ${failedTypes.join(", ")}`
                    : (packageScanJob.warning ?? null);

            setProgress({ percent: 100, label: "Scan complete" });
            appendLog(warning ? `Scan complete with warning: ${warning}` : "Scan complete");

            this.webSocketBroadcaster.broadcast("scan:complete", {
                projectId: referenceId,
                warning
            });
            this.eventBus.emit("scan:completed", referenceId);
        } catch (error) {
            await Promise.all(
                enqueuedChildJobIds.map(async childJobId => {
                    try {
                        await jobWorker.cancelJob(childJobId);
                    } catch {
                        // Best-effort cleanup — cancellation failures shouldn't mask the original error.
                    }
                })
            );

            this.webSocketBroadcaster.broadcast("scan:failed", {
                projectId: referenceId,
                error: String(error)
            });

            throw error;
        }
    }
}

export const ScanJobExecutor = Abstraction.createImplementation({
    implementation: ScanJobExecutorImpl,
    dependencies: [
        JobWorkerProvider,
        PackageManagerDriverRegistry,
        WebSocketBroadcaster,
        EventBus,
        DatabaseClient
    ]
});
