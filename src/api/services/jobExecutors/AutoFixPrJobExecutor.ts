import { eq, and } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { AutoFixPrJobExecutor as Abstraction } from "./abstractions/AutoFixPrJobExecutor.js";
import { AutoFixPrService } from "../AutoFix/index.js";
import { GitService } from "../Git/index.js";
import { ForgeService } from "../Git/index.js";
import { UpgradeService } from "../Upgrade/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { autoFixPullRequests } from "#api/db/schema.js";

class AutoFixPrJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "auto-fix-pr";

    public constructor(
        private readonly autoFixPrService: AutoFixPrService.Interface,
        private readonly gitService: GitService.Interface,
        private readonly forgeService: ForgeService.Interface,
        private readonly upgradeService: UpgradeService.Interface,
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const projectId = context.referenceId;

        // Step 1: Generate pending records via orchestration service
        await this.autoFixPrService.generateForProject(projectId);

        // Step 2: Load all pending records
        const pendingRecords = await this.databaseClient.db
            .select()
            .from(autoFixPullRequests)
            .where(
                and(
                    eq(autoFixPullRequests.projectId, projectId),
                    eq(autoFixPullRequests.status, "pending")
                )
            )
            .all();

        if (pendingRecords.length === 0) {
            this.webSocketBroadcaster.broadcast("auto-fix:complete", {
                projectId,
                created: 0,
                skipped: 0,
                failed: 0
            });
            return;
        }

        // Step 3: Check working tree
        const status = await this.gitService.getStatus(context.projectPath);
        if (status.length > 0) {
            throw new Error(
                "Working tree is dirty — auto-fix requires a clean working directory. " +
                    "Commit or stash changes first."
            );
        }

        // Step 4: Save original branch
        const originalBranch = await this.gitService.getCurrentBranch(context.projectPath);

        const forgeType = await this.forgeService.detectForge(context.projectPath);
        if (forgeType === "unknown") {
            throw new Error("No forge configured — set github_token or gitlab_token in settings");
        }

        let created = 0;
        let failed = 0;

        // Step 5: Process each pending record
        for (let i = 0; i < pendingRecords.length; i++) {
            const record = pendingRecords[i]!;
            const packageNames = JSON.parse(record.packageNames) as string[];
            const fromVersions = JSON.parse(record.fromVersions) as Record<string, string>;
            const toVersions = JSON.parse(record.toVersions) as Record<string, string>;

            try {
                await this.gitService.createAndCheckoutBranch(
                    context.projectPath,
                    record.branchName
                );

                for (const packageName of packageNames) {
                    const targetVersion = toVersions[packageName];
                    if (targetVersion) {
                        await this.upgradeService.upgradePackage(
                            context.projectPath,
                            packageName,
                            targetVersion,
                            context.packageManager,
                            line => context.appendLog(line),
                            context.signal
                        );
                    }

                    this.webSocketBroadcaster.broadcast("auto-fix:progress", {
                        projectId,
                        packageName,
                        step: "upgrade",
                        current: i + 1,
                        total: pendingRecords.length
                    });
                }

                await this.gitService.stageAll(context.projectPath);

                const commitMessage =
                    packageNames.length === 1
                        ? `fix(deps): upgrade ${packageNames[0]} to ${toVersions[packageNames[0]!]}`
                        : `fix(deps): upgrade ${packageNames.length} packages (${record.upgradeType})`;

                await this.gitService.commit(context.projectPath, commitMessage);

                const pushResult = await this.gitService.push(
                    context.projectPath,
                    "origin",
                    record.branchName
                );

                if (!pushResult.success) {
                    throw new Error(`Push failed: ${pushResult.output}`);
                }

                // Build PR body
                const packages: AutoFixPrService.PackageUpgrade[] = packageNames.map(name => ({
                    packageName: name,
                    fromVersion: fromVersions[name] ?? "",
                    toVersion: toVersions[name] ?? "",
                    upgradeType: record.upgradeType
                }));
                const licenseWarnings = record.licenseWarnings
                    ? (JSON.parse(record.licenseWarnings) as string[])
                    : [];

                // Changelog resolution is handled by the existing changelog
                // system elsewhere; this executor doesn't look up excerpts.
                const changelogs: AutoFixPrService.ChangelogExcerpt[] = [];

                const body = this.autoFixPrService.buildPrBody(
                    packages,
                    changelogs,
                    licenseWarnings
                );

                const prResult = await this.forgeService.createPr({
                    projectPath: context.projectPath,
                    title: commitMessage,
                    body,
                    head: record.branchName,
                    base: originalBranch
                });

                await this.databaseClient.db
                    .update(autoFixPullRequests)
                    .set({
                        status: "created",
                        prUrl: prResult.url,
                        prNumber: prResult.number,
                        updatedAt: Date.now()
                    })
                    .where(eq(autoFixPullRequests.id, record.id))
                    .run();

                created++;
            } catch (error) {
                await this.databaseClient.db
                    .update(autoFixPullRequests)
                    .set({
                        status: "failed",
                        updatedAt: Date.now()
                    })
                    .where(eq(autoFixPullRequests.id, record.id))
                    .run();
                failed++;
                context.appendLog(
                    `Auto-fix failed for ${packageNames.join(", ")}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            } finally {
                try {
                    await this.gitService.checkout(context.projectPath, originalBranch);
                } catch {
                    // Best effort — if checkout fails, the next iteration will fail too.
                }
            }
        }

        this.webSocketBroadcaster.broadcast("auto-fix:complete", {
            projectId,
            created,
            skipped: 0,
            failed
        });
    }
}

export const AutoFixPrJobExecutor = Abstraction.createImplementation({
    implementation: AutoFixPrJobExecutorImpl,
    dependencies: [
        AutoFixPrService,
        GitService,
        ForgeService,
        UpgradeService,
        DatabaseClient,
        WebSocketBroadcaster
    ]
});
