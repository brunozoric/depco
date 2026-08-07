import { z } from "zod";
import { eq } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { CloneJobExecutor as Abstraction } from "./abstractions/CloneJobExecutor.js";
import { CommandRunner } from "../CommandRunner/index.js";
import { PackageManagerService } from "../PackageManager/index.js";
import { SecurityService } from "../Security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { registerProject } from "../registerProject.js";
import { upgradeJobs } from "#api/db/schema.js";

const clonePackagesSchema = z.object({
    url: z.string().regex(/^(https:\/\/|git@)/, "Only https:// and git@ URLs are supported"),
    destination: z.string().refine(value => !value.startsWith("-"), "Path must not start with -")
});

class CloneJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "clone";

    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly packageManagerService: PackageManagerService.Interface,
        private readonly securityService: SecurityService.Interface,
        private readonly databaseClient: DatabaseClient.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const { url, destination } = clonePackagesSchema.parse(
            JSON.parse(context.packagesJson ?? "{}")
        );

        await this.commandRunner.runStreaming("git", ["clone", "--", url, destination], {
            cwd: context.projectPath,
            onStdout: context.appendLog,
            onStderr: context.appendLog,
            signal: context.signal
        });

        const registered = await registerProject({
            projectPath: destination,
            databaseClient: this.databaseClient,
            packageManagerService: this.packageManagerService
        });

        await this.databaseClient.db
            .update(upgradeJobs)
            .set({
                packages: JSON.stringify({
                    url,
                    destination,
                    projectId: registered.id
                })
            })
            .where(eq(upgradeJobs.id, context.jobId))
            .run();

        // Security check runs after registration but must not fail the clone job
        // (or crash the process) if it errors — the project is already registered.
        this.securityService.check(registered.id, destination).catch(() => {});
    }
}

export const CloneJobExecutor = Abstraction.createImplementation({
    implementation: CloneJobExecutorImpl,
    dependencies: [CommandRunner, PackageManagerService, SecurityService, DatabaseClient]
});
