import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { PackageScanJobExecutor as Abstraction } from "./abstractions/PackageScanJobExecutor.js";
import { ScanService } from "../Scan/index.js";
import { PackageManagerService } from "../PackageManager/index.js";
import { SecurityService } from "../Security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { ErrorReporter } from "../ErrorReporter/index.js";
import { DependencyChangeService } from "../DependencyChange/index.js";
import {
    projects,
    scanResults,
    upgradeJobs,
    pmSecuritySettings,
    dependencies,
    dependencyVersions,
    changelogs
} from "#api/db/schema.js";
import { parseDuration } from "#shared/security/index.js";

const AGE_GATE_FIELDS: Record<string, string> = {
    yarn: "npmMinimalAgeGate",
    npm: "minimal-age-gate",
    pnpm: "minimal-age-gate",
    bun: "minimal-age-gate"
};

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

    private async hasPackageJsonDeps(projectPath: string): Promise<boolean> {
        try {
            const content = await readFile(join(projectPath, "package.json"), "utf-8");
            const pkg = JSON.parse(content) as Record<string, unknown>;
            const deps = Object.keys((pkg["dependencies"] as Record<string, string>) ?? {});
            const devDeps = Object.keys((pkg["devDependencies"] as Record<string, string>) ?? {});
            return deps.length + devDeps.length > 0;
        } catch {
            return false;
        }
    }

    private async resolveMinimalAgeSeconds(packageManager: string): Promise<number | undefined> {
        const fieldName = AGE_GATE_FIELDS[packageManager];
        if (!fieldName) {
            return undefined;
        }

        const setting = await this.databaseClient.db
            .select()
            .from(pmSecuritySettings)
            .where(
                and(
                    eq(pmSecuritySettings.packageManager, packageManager),
                    eq(pmSecuritySettings.fieldName, fieldName)
                )
            )
            .get();

        if (!setting) {
            return undefined;
        }

        try {
            return parseDuration(setting.expectedValue);
        } catch {
            return undefined;
        }
    }

    private async insertChangelogPlaceholders(
        scanDependencies: ScanService.Dependency[],
        registryData: Map<string, ScanService.RegistryData>,
        minimalAgeSeconds?: number
    ): Promise<void> {
        const ageCutoff =
            minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

        for (const dep of scanDependencies) {
            const data = registryData.get(dep.name);
            if (!data || dep.latestVersion === null) {
                continue;
            }

            const currentIndex = data.versions.indexOf(dep.currentVersion);
            const latestIndex = data.versions.indexOf(dep.latestVersion);
            if (latestIndex === -1) {
                continue;
            }

            const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
            let upgradeableVersions = data.versions
                .slice(startIndex, latestIndex + 1)
                .filter(version => !version.includes("-"));

            if (ageCutoff !== undefined) {
                upgradeableVersions = upgradeableVersions.filter(version => {
                    const publishTime = data.time[version];
                    return publishTime ? new Date(publishTime).getTime() <= ageCutoff : true;
                });
            }

            const versionsToStore =
                upgradeableVersions.length > 0 ? upgradeableVersions : [dep.currentVersion];

            // Upsert dependency row
            await this.databaseClient.db
                .insert(dependencies)
                .values({
                    id: generateId(),
                    name: dep.name,
                    repoUrl: data.repoUrl,
                    repoDirectory: data.repoDirectory,
                    createdAt: Date.now()
                })
                .onConflictDoUpdate({
                    target: dependencies.name,
                    set: { repoUrl: data.repoUrl, repoDirectory: data.repoDirectory }
                })
                .run();

            const depRow = await this.databaseClient.db
                .select({ id: dependencies.id })
                .from(dependencies)
                .where(eq(dependencies.name, dep.name))
                .get();

            if (!depRow) {
                continue;
            }

            const dependencyId = depRow.id;

            // Upsert version rows + insert changelog placeholders
            for (const version of versionsToStore) {
                const publishedAt = data.time[version]
                    ? new Date(data.time[version]!).getTime()
                    : null;

                await this.databaseClient.db
                    .insert(dependencyVersions)
                    .values({
                        id: generateId(),
                        dependencyId,
                        version,
                        publishedAt
                    })
                    .onConflictDoNothing()
                    .run();

                const versionRow = await this.databaseClient.db
                    .select({ id: dependencyVersions.id })
                    .from(dependencyVersions)
                    .where(
                        and(
                            eq(dependencyVersions.dependencyId, dependencyId),
                            eq(dependencyVersions.version, version)
                        )
                    )
                    .get();

                if (!versionRow) {
                    continue;
                }

                const existingChangelog = await this.databaseClient.db
                    .select({ id: changelogs.id })
                    .from(changelogs)
                    .where(eq(changelogs.dependencyVersionId, versionRow.id))
                    .get();

                if (!existingChangelog) {
                    await this.databaseClient.db
                        .insert(changelogs)
                        .values({
                            id: generateId(),
                            dependencyId,
                            dependencyVersionId: versionRow.id
                        })
                        .run();
                }
            }
        }
    }

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const scanPackages = scanPackagesSchema.parse(JSON.parse(context.packagesJson ?? "{}"));
        const minimalAgeSeconds = await this.resolveMinimalAgeSeconds(context.packageManager);

        context.appendLog(`Starting package scan for project ${context.referenceId}`);
        context.appendLog(`Package manager: ${context.packageManager}`);
        if (scanPackages.force) {
            context.appendLog("Force mode enabled — bypassing registry cache");
        }
        context.setProgress({ percent: 0, label: "Collecting installed packages..." });

        // Fire-and-forget: persists a securityChecks row alongside the scan.
        // Runs in parallel with the scan itself; a failure here must not
        // fail the scan.
        const securityCheckPromise = (async (): Promise<void> => {
            try {
                await this.securityService.check(context.referenceId, context.projectPath);
            } catch {
                // Intentionally swallowed — see comment above.
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

        await this.databaseClient.db
            .delete(scanResults)
            .where(eq(scanResults.projectId, context.referenceId))
            .run();

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
                this.databaseClient.db
                    .insert(scanResults)
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

        await this.databaseClient.db
            .update(projects)
            .set({
                lastScannedAt: Date.now(),
                packageManager: context.packageManager,
                ...(pmVersion !== null ? { pmVersion } : {})
            })
            .where(eq(projects.id, context.referenceId))
            .run();

        await this.insertChangelogPlaceholders(results, registryData, minimalAgeSeconds);

        let warning: string | null = null;
        if (results.length === 0) {
            const hasDeps = await this.hasPackageJsonDeps(context.projectPath);
            if (hasDeps) {
                warning =
                    "Lockfile may be stale or missing — 0 dependencies found despite package.json listing dependencies. Run install to regenerate.";
            }
        }

        if (warning) {
            await this.databaseClient.db
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
