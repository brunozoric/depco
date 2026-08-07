import { eq } from "drizzle-orm";
import { RegistryCacheService as Abstraction } from "./abstractions/RegistryCacheService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { PackageManagerDriverRegistry } from "./packageManagers/abstractions/PackageManagerDriverRegistry.js";
import type { PackageManagerDriver } from "./packageManagers/abstractions/PackageManagerDriver.js";
import { FileConfigService } from "./abstractions/FileConfigService.js";
import { registryCache } from "#api/db/schema.js";

import { parseLicense } from "./packageManagers/parseLicense.js";

const TTL_MS = 30 * 60 * 1000;

class RegistryCacheServiceImpl implements Abstraction.Interface {
    private readonly inFlight = new Map<string, Promise<Abstraction.PackageInfo>>();

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly commandRunner: CommandRunner.Interface,
        private readonly registry: PackageManagerDriverRegistry.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async getPackageInfo(
        packageName: string,
        packageManager: string,
        force?: boolean,
        project?: Abstraction.Project
    ): Promise<Abstraction.PackageInfo> {
        const existing = this.inFlight.get(packageName);
        if (existing) {
            return existing;
        }

        const promise = this.fetchPackageInfo(packageName, packageManager, force, project).finally(
            () => {
                this.inFlight.delete(packageName);
            }
        );

        this.inFlight.set(packageName, promise);
        return promise;
    }

    private async fetchPackageInfo(
        packageName: string,
        packageManager: string,
        force?: boolean,
        project?: Abstraction.Project
    ): Promise<Abstraction.PackageInfo> {
        if (!force) {
            const cached = await this.databaseClient.db
                .select()
                .from(registryCache)
                .where(eq(registryCache.packageName, packageName))
                .get();

            if (cached && Date.now() - cached.cachedAt < TTL_MS) {
                const info = JSON.parse(cached.data) as Abstraction.PackageInfo;
                info.license = parseLicense(info.license);
                return info;
            }
        }

        if (packageName.startsWith("-")) {
            throw new Error(`Invalid package name: ${packageName}`);
        }

        const driver = this.registry.getDriver(packageManager);
        const fileConfigResult = await this.fileConfigService.readGlobalConfig();
        const registryUrl = fileConfigResult.config?.pmSettings?.[packageManager]?.registryUrl;
        const { command, args } = driver.registryInfoCommand(packageName, registryUrl);
        const result = await this.commandRunner.run(command, args, {
            cwd: project?.path ?? process.cwd()
        });

        if (result.exitCode !== 0) {
            const cmdString = `${command} ${args.join(" ")}`;
            throw new Error(
                `Registry command failed for "${packageName}"\n` +
                    `Command: ${cmdString}\n` +
                    `Exit code: ${result.exitCode}\n` +
                    `Stderr: ${result.stderr}\n` +
                    `Stdout: ${result.stdout}`
            );
        }

        const parsed = this.parseWithContext(
            driver,
            result.stdout,
            command,
            args,
            packageName,
            result.exitCode
        );
        const info: Abstraction.PackageInfo = {
            name: packageName,
            latestVersion: parsed.latestVersion,
            distTags: parsed.distTags,
            versions: parsed.versions,
            time: parsed.time,
            repoUrl: parsed.repoUrl,
            repoDirectory: parsed.repoDirectory,
            readme: parsed.readme,
            license: parseLicense(parsed.license)
        };

        await this.databaseClient.db
            .insert(registryCache)
            .values({
                packageName,
                data: JSON.stringify(info),
                cachedAt: Date.now()
            })
            .onConflictDoUpdate({
                target: registryCache.packageName,
                set: {
                    data: JSON.stringify(info),
                    cachedAt: Date.now()
                }
            })
            .run();

        return info;
    }

    public async clearAll(): Promise<void> {
        await this.databaseClient.db.delete(registryCache).run();
    }

    private parseWithContext(
        driver: PackageManagerDriver.Interface,
        stdout: string,
        command: string,
        args: string[],
        packageName: string,
        exitCode: number
    ): PackageManagerDriver.RegistryPackageInfo {
        try {
            return driver.parseRegistryInfo(stdout);
        } catch (parseError) {
            const cmdString = `${command} ${args.join(" ")}`;
            throw new Error(
                `Failed to parse registry info for "${packageName}"\n` +
                    `Command: ${cmdString}\n` +
                    `Exit code: ${exitCode}\n` +
                    `Stdout: ${stdout}\n` +
                    `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
        }
    }

    public async clearPackage(packageName: string): Promise<void> {
        await this.databaseClient.db
            .delete(registryCache)
            .where(eq(registryCache.packageName, packageName))
            .run();
    }
}

export const RegistryCacheService = Abstraction.createImplementation({
    implementation: RegistryCacheServiceImpl,
    dependencies: [DatabaseClient, CommandRunner, PackageManagerDriverRegistry, FileConfigService]
});
