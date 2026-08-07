import { existsSync } from "fs";
import { join } from "path";
import { PackageManagerService as Abstraction } from "./abstractions/PackageManagerService.js";
import { CommandRunner } from "./CommandRunner/index.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";
import { AuditParserService } from "./Vulnerability/index.js";

class PackageManagerServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly registry: PackageManagerDriverRegistry.Interface,
        private readonly auditParserService: AuditParserService.Interface
    ) {}

    public async detect(projectPath: string): Promise<Abstraction.PackageManager> {
        for (const driver of this.registry.getAllDrivers()) {
            if (existsSync(join(projectPath, driver.lockfileName))) {
                return driver.id;
            }
        }
        throw new Error(
            `No package manager detected for ${projectPath}. Expected one of: yarn.lock, pnpm-lock.yaml, package-lock.json`
        );
    }

    public async getVersion(projectPath: string, packageManager: string): Promise<string> {
        const { command, args } = this.registry.getDriver(packageManager).versionCommand();
        const result = await this.commandRunner.run(command, args, { cwd: projectPath });
        return result.stdout.trim();
    }

    public async updateVersion(
        projectPath: string,
        packageManager: string,
        version: string,
        onLog: (line: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { command, args } = this.registry
            .getDriver(packageManager)
            .updateVersionCommand(version);
        await this.commandRunner.runStreaming(command, args, {
            cwd: projectPath,
            onStdout: onLog,
            onStderr: onLog,
            ...(signal ? { signal } : {})
        });
    }

    public async audit(
        projectPath: string,
        packageManager: string
    ): Promise<Abstraction.AuditVulnerability[]> {
        const { command, args } = this.registry.getDriver(packageManager).auditCommand();
        const result = await this.commandRunner.run(command, args, { cwd: projectPath });

        if (result.exitCode > 1) {
            throw new Error(
                `Audit command failed for ${packageManager} at ${projectPath} (exit ${result.exitCode}): ${result.stderr || result.stdout}`
            );
        }
        if (!result.stdout.trim() && result.stderr.trim()) {
            throw new Error(
                `Audit command failed for ${packageManager} at ${projectPath}: ${result.stderr}`
            );
        }

        return this.auditParserService.parse(result.stdout, packageManager);
    }
}

export const PackageManagerService = Abstraction.createImplementation({
    implementation: PackageManagerServiceImpl,
    dependencies: [CommandRunner, PackageManagerDriverRegistry, AuditParserService]
});
