import { eq, and } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { TransitiveResolveJobExecutor as Abstraction } from "./abstractions/TransitiveResolveJobExecutor.js";
import { RegistryCacheService } from "../RegistryCache/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { scanResults } from "#api/db/schema.js";
import { classifyUpgrade } from "#shared/versions/types.js";

const LOOKUP_CONCURRENCY = 10;

class TransitiveResolveJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "transitive-resolve" as const;

    public constructor(
        private readonly registryCacheService: RegistryCacheService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const { db } = this.databaseClient;
        const unresolved = await db
            .select()
            .from(scanResults)
            .where(
                and(
                    eq(scanResults.projectId, context.referenceId),
                    eq(scanResults.registryResolved, 0)
                )
            )
            .all();

        if (unresolved.length === 0) {
            context.appendLog("No unresolved transitive dependencies.");
            context.setProgress({ percent: 100, label: "Nothing to resolve" });
            return;
        }

        context.appendLog(`Resolving ${unresolved.length} transitive dependencies...`);
        const total = unresolved.length;
        let processed = 0;
        let failedCount = 0;

        for (let i = 0; i < unresolved.length; i += LOOKUP_CONCURRENCY) {
            const batch = unresolved.slice(i, i + LOOKUP_CONCURRENCY);
            const resolutions = await Promise.all(
                batch.map(async row => {
                    let info: RegistryCacheService.PackageInfo | null = null;
                    let failed = false;

                    try {
                        info = await this.registryCacheService.getPackageInfo(
                            row.name,
                            context.packageManager
                        );
                    } catch (error) {
                        failed = true;
                        const message = error instanceof Error ? error.message : String(error);
                        context.appendLog(`Failed to resolve ${row.name}: ${message}`);
                    }

                    processed++;
                    context.setProgress({
                        percent: Math.round((processed / total) * 95),
                        label: `Resolving transitive: ${processed}/${total}`
                    });
                    return { row, info, failed };
                })
            );

            for (const { row, info, failed } of resolutions) {
                if (failed || !info) {
                    failedCount++;
                    await db
                        .update(scanResults)
                        .set({
                            registryResolved: 1,
                            scannedAt: Date.now()
                        })
                        .where(eq(scanResults.id, row.id))
                        .run();
                    continue;
                }

                const latestVersion = info.latestVersion || row.currentVersion;
                const upgradeType = classifyUpgrade({
                    currentVersion: row.currentVersion,
                    latestVersion
                });

                await db
                    .update(scanResults)
                    .set({
                        latestVersion,
                        latestInRange: row.currentVersion,
                        upgradeType,
                        registryResolved: 1,
                        scannedAt: Date.now()
                    })
                    .where(eq(scanResults.id, row.id))
                    .run();
            }
        }

        context.setProgress({ percent: 100, label: "Resolution complete" });
        context.appendLog(
            failedCount > 0
                ? `Resolved ${total} transitive dependencies (${failedCount} failed).`
                : `Resolved ${total} transitive dependencies.`
        );

        this.webSocketBroadcaster.broadcast("transitive-resolve:complete", {
            projectId: context.referenceId,
            resolved: total,
            failed: failedCount
        });
    }
}

export const TransitiveResolveJobExecutor = Abstraction.createImplementation({
    implementation: TransitiveResolveJobExecutorImpl,
    dependencies: [RegistryCacheService, DatabaseClient, WebSocketBroadcaster]
});
