import { ScanService as Abstraction } from "./abstractions/ScanService.js";
import { CommandRunner } from "../CommandRunner/index.js";
import { RegistryCacheService } from "../RegistryCache/index.js";
import { LockfileParserService } from "../DependencyGraph/index.js";
import { PackageManagerDriverRegistry } from "../PackageManager/abstractions/PackageManagerDriverRegistry.js";
import { WorkspaceScanner } from "./WorkspaceScanner.js";
import { DependencyResolver } from "./DependencyResolver.js";

class ScanServiceImpl implements Abstraction.Interface {
    private readonly workspaceScanner: WorkspaceScanner;
    private readonly dependencyResolver: DependencyResolver;

    public constructor(
        commandRunner: CommandRunner.Interface,
        registryCacheService: RegistryCacheService.Interface,
        private readonly lockfileParserService: LockfileParserService.Interface,
        registry: PackageManagerDriverRegistry.Interface
    ) {
        this.workspaceScanner = new WorkspaceScanner(commandRunner, registry);
        this.dependencyResolver = new DependencyResolver(registryCacheService);
    }

    private async collectInstalledVersions(
        projectPath: string,
        packageManager: string
    ): Promise<Map<string, string>> {
        const edges = await this.lockfileParserService.parse(projectPath, packageManager);
        const versions = new Map<string, string>();
        for (const edge of edges) {
            if (!versions.has(edge.childPackage)) {
                versions.set(edge.childPackage, edge.childVersion);
            }
        }
        return versions;
    }

    public async scan(
        projectPath: string,
        packageManager: string,
        force?: boolean,
        onProgress?: (packageName: string, current: number, total: number) => void,
        signal?: AbortSignal,
        minimalAgeSeconds?: number,
        project?: RegistryCacheService.Project
    ): Promise<Abstraction.Result> {
        const [installedVersions, dependencyTypes, workspacePackageNames] = await Promise.all([
            this.collectInstalledVersions(projectPath, packageManager),
            this.workspaceScanner.collectDependencyTypes(projectPath, packageManager, signal),
            this.workspaceScanner.collectWorkspacePackageNames(projectPath, packageManager, signal)
        ]);

        for (const name of workspacePackageNames) {
            installedVersions.delete(name);
        }

        const entries = Array.from(dependencyTypes.entries()).filter(([name]) =>
            installedVersions.has(name)
        );

        const ageCutoff =
            minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

        const { results, registryData } = await this.dependencyResolver.resolveEntries({
            entries,
            installedVersions,
            packageManager,
            force,
            project,
            onProgress,
            ageCutoff
        });

        for (const [name, version] of installedVersions.entries()) {
            if (!dependencyTypes.has(name)) {
                results.push({
                    name,
                    currentVersion: version,
                    latestInRange: null,
                    latestVersion: null,
                    dependencyKind: "transitive",
                    upgradeType: null,
                    registryResolved: false
                });
            }
        }

        return { dependencies: results, registryData, installedVersions };
    }
}

export const ScanService = Abstraction.createImplementation({
    implementation: ScanServiceImpl,
    dependencies: [
        CommandRunner,
        RegistryCacheService,
        LockfileParserService,
        PackageManagerDriverRegistry
    ]
});
