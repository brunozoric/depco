import { UpgradeService as Abstraction } from "./abstractions/UpgradeService.js";
import { CommandRunner } from "./CommandRunner/index.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";
import { FileConfigService } from "./abstractions/FileConfigService.js";

function applyVersionStrategy(
    version: string,
    strategy?: FileConfigService.PmSettings["upgradeStrategy"]
): string {
    switch (strategy) {
        case "caret":
            return `^${version}`;
        case "tilde":
            return `~${version}`;
        case "latest":
            return "*";
        case "exact":
            return version;
        default:
            return `^${version}`;
    }
}

class UpgradeServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly registry: PackageManagerDriverRegistry.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async upgradePackage(
        projectPath: string,
        packageName: string,
        targetVersion: string,
        packageManager: string,
        onLog: (line: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        if (packageName.startsWith("-")) {
            throw new Error(`Invalid package name: ${packageName}`);
        }

        const fileConfigResult = await this.fileConfigService.readGlobalConfig();
        const strategy = fileConfigResult.config?.pmSettings?.[packageManager]?.upgradeStrategy;
        const prefixedVersion = applyVersionStrategy(targetVersion, strategy);

        const { command, args } = this.registry
            .getDriver(packageManager)
            .upgradePackageCommand(packageName, prefixedVersion);
        await this.commandRunner.runStreaming(command, args, {
            cwd: projectPath,
            onStdout: onLog,
            onStderr: onLog,
            ...(signal ? { signal } : {})
        });
    }

    public async refreshTransient(
        projectPath: string,
        packageManager: string,
        onLog: (line: string) => void,
        signal?: AbortSignal,
        packageNames?: string[]
    ): Promise<void> {
        const { command, args } = this.registry
            .getDriver(packageManager)
            .refreshTransientCommand(packageNames);
        await this.commandRunner.runStreaming(command, args, {
            cwd: projectPath,
            onStdout: onLog,
            onStderr: onLog,
            ...(signal ? { signal } : {})
        });
    }
}

export const UpgradeService = Abstraction.createImplementation({
    implementation: UpgradeServiceImpl,
    dependencies: [CommandRunner, PackageManagerDriverRegistry, FileConfigService]
});
