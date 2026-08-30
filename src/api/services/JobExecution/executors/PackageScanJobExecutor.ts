import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { PackageScanJobExecutor as Abstraction } from "./abstractions/PackageScanJobExecutor.js";
import { ScanService } from "../../Scan/index.js";
import { PackageManagerService } from "../../PackageManager/index.js";
import { SecurityService } from "../../Security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { ErrorReporter } from "../../ErrorReporter/index.js";
import { DependencyChangeService } from "../../DependencyChange/index.js";
import { projects, scanResults, upgradeJobs } from "#api/db/schema.js";
import {
    hasPackageJsonDependencies,
    resolveMinimalAgeSeconds,
    insertChangelogPlaceholders
} from "./packageScanHelpers.js";

const scanPackagesSchema = z.object({
    force: z.boolean().optional()
});

class PackageScanJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "package-scan" as const;

    public constructor(
        private readonly scanService: ScanService.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly errorReporter: ErrorReporter.Interface,
        private readonly dependencyChangeService: DependencyChangeService.Interface,
        private readonly securityService: SecurityService.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const parseResult = scanPackagesSchema.safeParse(JSON.parse(context.packagesJson ?? "{}"));
        if (!parseResult.success) {
            throw new Error(
                `Invalid scan packages payload: ${parseResult.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const scanPackages = parseResult.data;
        const { db } = this.databaseClient;
        const minimalAgeSeconds = await resolveMinimalAgeSeconds(db, context.packageManager);

        context.appendLog(`Starting package scan for project ${context.referenceId}`);
        context.appendLog(`Package manager: ${context.packageManager}`);
        if (scanPackages.force) {
            context.appendLog("Force mode enabled — bypassing registry cache");
        }
        context.setProgress({ percent: 0, label: "Collecting installed packages..." });

        const securityCheckPromise = (async (): Promise<void> => {
            try {
                await this.securityService.check(context.referenceId, context.projectPath);
            } catch {
                // Intentionally swallowed — runs in parallel with scan.
            }
        })();

        const scanResult = await this.scanService.scan(
            context.projectPath,
            context.packageManager,
            scanPackages.force,
            (packageName, current, total) => {
                this.webSocketBroadcaster.broadcast("scan:progress", {
                    projectId: context.referenceId,
                    packageName,
                    current,
                    total
                });
                context.setProgress({
                    percent: 10 + Math.round((current / total) * 70),
                    label: `Resolving dependencies: ${current}/${total}`
                });
            },
            context.signal,
            minimalAgeSeconds,
            context.project ?? undefined
        );

        await securityCheckPromise;

        const { dependencies: results, registryData } = scanResult;

        const directCount = results.filter(d => d.registryResolved).length;
        const transitiveCount = results.filter(d => d.dependencyKind === "transitive").length;
        context.appendLog(
            `Found ${results.length} packages (${directCount} direct, ${transitiveCount} transitive)`
        );
        context.setProgress({ percent: 85, label: "Saving scan results..." });

        try {
            await this.dependencyChangeService.detectAndPersist(
                context.referenceId,
                results.map(dependency => ({
                    name: dependency.name,
                    currentVersion: dependency.currentVersion
                }))
            );
        } catch {
            void this.errorReporter.reportJobWarning(
                context.jobId,
                context.referenceId,
                context.projectPath,
                context.packageManager,
                "Dependency change detection failed"
            );
        }

        await db.delete(scanResults).where(eq(scanResults.projectId, context.referenceId)).run();

        if (results.length > 0) {
            const scannedAt = Date.now();
            const rows = results.map(dependency => ({
                id: generateId(),
                projectId: context.referenceId,
                name: dependency.name,
                currentVersion: dependency.currentVersion,
                latestVersion: dependency.latestVersion,
                latestInRange: dependency.latestInRange,
                type: dependency.dependencyKind,
                upgradeType: dependency.upgradeType,
                dependencyKind: dependency.dependencyKind,
                registryResolved: dependency.registryResolved ? 1 : 0,
                scannedAt
            }));

            const BATCH_SIZE = 100;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                db.insert(scanResults)
                    .values(rows.slice(i, i + BATCH_SIZE))
                    .run();
            }
        }

        context.appendLog(`Saved ${results.length} scan results`);
        context.setProgress({ percent: 92, label: "Updating project metadata..." });

        let pmVersion: string | null = null;
        try {
            pmVersion = await this.packageManagerService.getVersion(
                context.projectPath,
                context.packageManager
            );
        } catch {
            pmVersion = null;
        }

        await db
            .update(projects)
            .set({
                lastScannedAt: Date.now(),
                packageManager: context.packageManager,
                ...(pmVersion !== null ? { pmVersion } : {})
            })
            .where(eq(projects.id, context.referenceId))
            .run();

        await insertChangelogPlaceholders({
            db,
            scanDependencies: results,
            registryData,
            minimalAgeSeconds
        });

        let warning: string | null = null;
        if (results.length === 0) {
            const hasDeps = await hasPackageJsonDependencies(context.projectPath);
            if (hasDeps) {
                warning =
                    "Lockfile may be stale or missing — 0 dependencies found despite package.json listing dependencies. Run install to regenerate.";
            }
        }

        if (warning) {
            await db
                .update(upgradeJobs)
                .set({ warning })
                .where(eq(upgradeJobs.id, context.jobId))
                .run();

            await this.errorReporter.reportJobWarning(
                context.jobId,
                context.referenceId,
                context.projectPath,
                context.packageManager,
                warning
            );
        }

        context.setProgress({ percent: 100, label: "Package scan complete" });
        context.appendLog(`Package scan complete: ${results.length} packages found`);
    }
}

export const PackageScanJobExecutor = Abstraction.createImplementation({
    implementation: PackageScanJobExecutorImpl,
    dependencies: [
        ScanService,
        PackageManagerService,
        DatabaseClient,
        WebSocketBroadcaster,
        ErrorReporter,
        DependencyChangeService,
        SecurityService
    ]
});
