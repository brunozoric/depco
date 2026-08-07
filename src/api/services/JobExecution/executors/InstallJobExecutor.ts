import { z } from "zod";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { InstallJobExecutor as Abstraction } from "./abstractions/InstallJobExecutor.js";
import { PackageManagerDriverRegistry } from "../PackageManager/abstractions/PackageManagerDriverRegistry.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService } from "../../FileConfig/index.js";

class InstallJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "install";

    public constructor(
        private readonly driverRegistry: PackageManagerDriverRegistry.Interface,
        private readonly commandRunner: CommandRunner.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const driver = this.driverRegistry.getDriver(context.packageManager);

        // File config (.dependency-upgrader.json) takes precedence over
        // user-selected flags from the request when present for this PM.
        const fileConfigResult = await this.fileConfigService.readGlobalConfig();
        const pmConfig = fileConfigResult.config?.pmSettings?.[context.packageManager];
        const fileFlags = pmConfig?.installFlags;

        let flags: string[];

        if (fileFlags) {
            flags = Object.entries(fileFlags)
                .filter(([, enabled]) => enabled)
                .map(([flag]) => flag);
        } else {
            const allowedFlags = driver.installFlags().map(f => f.flag);

            const schema = z.object({
                flags: z
                    .array(
                        allowedFlags.length > 0
                            ? z.enum(allowedFlags as [string, ...string[]])
                            : z.never()
                    )
                    .default([])
            });

            const parsed = schema.parse(JSON.parse(context.packagesJson ?? "{}"));
            flags = parsed.flags;
        }

        try {
            await this.commandRunner.run(context.packageManager, ["--version"], {
                cwd: context.projectPath
            });
        } catch {
            throw new Error(
                `Package manager "${context.packageManager}" is not installed. Install it first.`
            );
        }

        const { command, args } = driver.installCommand(flags);
        await this.commandRunner.runStreaming(command, args, {
            cwd: context.projectPath,
            onStdout: context.appendLog,
            onStderr: context.appendLog,
            signal: context.signal
        });

        this.webSocketBroadcaster.broadcast("install:complete", {
            projectId: context.referenceId
        });
    }
}

export const InstallJobExecutor = Abstraction.createImplementation({
    implementation: InstallJobExecutorImpl,
    dependencies: [
        PackageManagerDriverRegistry,
        CommandRunner,
        WebSocketBroadcaster,
        FileConfigService
    ]
});
