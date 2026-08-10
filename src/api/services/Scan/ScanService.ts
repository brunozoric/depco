import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import semver from "semver";
import { ScanService as Abstraction } from "./abstractions/ScanService.js";
import { CommandRunner } from "../CommandRunner/index.js";
import { RegistryCacheService } from "../RegistryCache/index.js";
import { LockfileParserService } from "../DependencyGraph/index.js";
import { PackageManagerDriverRegistry } from "../PackageManager/abstractions/PackageManagerDriverRegistry.js";
import { classifyUpgrade } from "#shared/versions/types.js";
import { globWorkspacePattern } from "../../utils/globWorkspacePattern.js";

interface IWorkspaceEntry {
    location: string;
}

interface IPackageJson {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
}

const dependencyRecord = z.record(z.string(), z.string()).optional();

const packageJsonSchema = z.object({
    name: z.string().optional(),
    dependencies: dependencyRecord,
    devDependencies: dependencyRecord,
    peerDependencies: dependencyRecord,
    optionalDependencies: dependencyRecord,
    workspaces: z
        .union([z.array(z.string()), z.object({ packages: z.array(z.string()).optional() })])
        .optional()
});

const LOOKUP_CONCURRENCY = 10;

function isStable(version: string): boolean {
    return semver.valid(version) !== null && semver.prerelease(version) === null;
}

function resolveLatestVersion(
    info: RegistryCacheService.PackageInfo,
    currentVersion: string,
    ageCutoff?: number
): string {
    const stableLatest = isStable(info.latestVersion) ? info.latestVersion : null;

    if (ageCutoff === undefined) {
        if (stableLatest) {
            return stableLatest;
        }
        const stableVersions = info.versions.filter(isStable);
        return stableVersions.length > 0
            ? stableVersions[stableVersions.length - 1]!
            : currentVersion;
    }

    if (stableLatest) {
        const publishedAt = info.time[stableLatest];
        if (publishedAt && new Date(publishedAt).getTime() <= ageCutoff) {
            return stableLatest;
        }
    }

    let best: string = currentVersion;
    let bestTime = 0;
    for (const version of info.versions) {
        if (!isStable(version)) {
            continue;
        }
        const versionTime = info.time[version];
        if (!versionTime) {
            continue;
        }
        const publishTime = new Date(versionTime).getTime();
        if (publishTime <= ageCutoff && publishTime > bestTime) {
            best = version;
            bestTime = publishTime;
        }
    }
    return best;
}

// Minimal glob support for workspace patterns (e.g. "packages/*",
// "apps/**"). Only "*" (one segment) and "**" (zero or more segments) are
// npm/pnpm workspace discovery: read the `workspaces` field from the root
// package.json and glob each pattern. Yarn has its own dedicated command
// (`yarn workspaces list --json`) handled separately in collectWorkspaces.
async function collectWorkspacesFromPackageJson(projectPath: string): Promise<IWorkspaceEntry[]> {
    let patterns: string[] = [];
    try {
        const content = await readFile(join(projectPath, "package.json"), "utf-8");
        const pkg = packageJsonSchema.parse(JSON.parse(content)) as IPackageJson;
        if (Array.isArray(pkg.workspaces)) {
            patterns = pkg.workspaces;
        } else if (pkg.workspaces?.packages) {
            patterns = pkg.workspaces.packages;
        }
    } catch {
        patterns = [];
    }

    if (patterns.length === 0) {
        return [{ location: "." }];
    }

    const includePatterns = patterns.filter(pattern => !pattern.startsWith("!"));
    const excludePatterns = patterns
        .filter(pattern => pattern.startsWith("!"))
        .map(pattern => pattern.slice(1));

    const [includedSets, excludedSets] = await Promise.all([
        Promise.all(includePatterns.map(pattern => globWorkspacePattern(projectPath, pattern))),
        Promise.all(excludePatterns.map(pattern => globWorkspacePattern(projectPath, pattern)))
    ]);

    const excluded = new Set(excludedSets.flat());
    const included = new Set(includedSets.flat().filter(location => !excluded.has(location)));

    return [{ location: "." }, ...Array.from(included, location => ({ location }))];
}

class ScanServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly registryCacheService: RegistryCacheService.Interface,
        private readonly lockfileParserService: LockfileParserService.Interface,
        private readonly registry: PackageManagerDriverRegistry.Interface
    ) {}

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

    private async collectWorkspaces(
        projectPath: string,
        packageManager: string,
        signal?: AbortSignal
    ): Promise<IWorkspaceEntry[]> {
        const driver = this.registry.getDriver(packageManager);
        const cmd = driver.workspacesCommand();
        if (cmd) {
            try {
                const result = await this.commandRunner.run(cmd.command, cmd.args, {
                    cwd: projectPath,
                    ...(signal ? { signal } : {})
                });
                return driver.parseWorkspaces(result.stdout);
            } catch {
                return [{ location: "." }];
            }
        }
        return collectWorkspacesFromPackageJson(projectPath);
    }

    private async collectDependencyTypes(
        projectPath: string,
        packageManager: string,
        signal?: AbortSignal
    ): Promise<
        Map<string, "dependency" | "devDependency" | "peerDependency" | "optionalDependency">
    > {
        const types = new Map<
            string,
            "dependency" | "devDependency" | "peerDependency" | "optionalDependency"
        >();

        const workspaces = await this.collectWorkspaces(projectPath, packageManager, signal);

        const readResults = await Promise.all(
            workspaces.map(async workspace => {
                const packageJsonPath = join(projectPath, workspace.location, "package.json");
                try {
                    const content = await readFile(packageJsonPath, "utf-8");
                    return packageJsonSchema.parse(JSON.parse(content)) as IPackageJson;
                } catch {
                    return null;
                }
            })
        );

        for (const packageJson of readResults) {
            if (!packageJson) {
                continue;
            }

            for (const name of Object.keys(packageJson.dependencies ?? {})) {
                if (!types.has(name)) {
                    types.set(name, "dependency");
                }
            }

            for (const name of Object.keys(packageJson.devDependencies ?? {})) {
                if (!types.has(name)) {
                    types.set(name, "devDependency");
                }
            }

            for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
                if (!types.has(name)) {
                    types.set(name, "peerDependency");
                }
            }

            for (const name of Object.keys(packageJson.optionalDependencies ?? {})) {
                if (!types.has(name)) {
                    types.set(name, "optionalDependency");
                }
            }
        }

        return types;
    }

    private async collectWorkspacePackageNames(
        projectPath: string,
        packageManager: string,
        signal?: AbortSignal
    ): Promise<Set<string>> {
        const workspaces = await this.collectWorkspaces(projectPath, packageManager, signal);
        const names = new Set<string>();
        for (const workspace of workspaces) {
            try {
                const content = await readFile(
                    join(projectPath, workspace.location, "package.json"),
                    "utf-8"
                );
                const pkg = packageJsonSchema.parse(JSON.parse(content)) as IPackageJson;
                if (pkg.name) {
                    names.add(pkg.name);
                }
            } catch {
                continue;
            }
        }
        return names;
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
            this.collectDependencyTypes(projectPath, packageManager, signal),
            this.collectWorkspacePackageNames(projectPath, packageManager, signal)
        ]);

        for (const name of workspacePackageNames) {
            installedVersions.delete(name);
        }

        const entries = Array.from(dependencyTypes.entries()).filter(([name]) =>
            installedVersions.has(name)
        );

        const results: Abstraction.Dependency[] = [];
        const registryData = new Map<string, Abstraction.RegistryData>();
        const total = entries.length;
        let processed = 0;
        const ageCutoff =
            minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

        for (let i = 0; i < entries.length; i += LOOKUP_CONCURRENCY) {
            const batch = entries.slice(i, i + LOOKUP_CONCURRENCY);
            const infos = await Promise.all(
                batch.map(async ([name]) => {
                    const info = await this.registryCacheService.getPackageInfo(
                        name,
                        packageManager,
                        force,
                        project
                    );
                    processed++;
                    onProgress?.(name, processed, total);
                    return info;
                })
            );

            for (let j = 0; j < batch.length; j++) {
                const [name, type] = batch[j]!;
                const currentVersion = installedVersions.get(name)!;
                const info = infos[j]!;
                const resolvedLatest =
                    resolveLatestVersion(info, currentVersion, ageCutoff) || currentVersion;
                const latestVersion =
                    semver.valid(resolvedLatest) &&
                    semver.valid(currentVersion) &&
                    semver.lt(resolvedLatest, currentVersion)
                        ? currentVersion
                        : resolvedLatest;
                const upgradeType = classifyUpgrade({ currentVersion, latestVersion });

                registryData.set(name, {
                    versions: info.versions,
                    repoUrl: info.repoUrl,
                    repoDirectory: info.repoDirectory,
                    time: info.time
                });

                results.push({
                    name,
                    currentVersion,
                    latestInRange: currentVersion,
                    latestVersion,
                    dependencyKind: type,
                    upgradeType,
                    registryResolved: true
                });
            }
        }

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
