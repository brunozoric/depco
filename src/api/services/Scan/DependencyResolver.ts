import semver from "semver";
import { RegistryCacheService } from "../RegistryCache/index.js";
import { classifyUpgrade } from "#shared/versions/types.js";
import type { ScanService as Abstraction } from "./abstractions/ScanService.js";
import type { DependencyType } from "./WorkspaceScanner.js";

export interface IResolveEntriesInput {
    entries: Array<[string, DependencyType]>;
    installedVersions: Map<string, string>;
    packageManager: string;
    force?: boolean | undefined;
    project?: RegistryCacheService.Project | undefined;
    onProgress?: ((packageName: string, current: number, total: number) => void) | undefined;
    ageCutoff?: number | undefined;
}

export interface IResolveEntriesResult {
    results: Abstraction.Dependency[];
    registryData: Map<string, Abstraction.RegistryData>;
}

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

/**
 * Batched registry lookups (via RegistryCacheService) plus upgrade
 * classification for a project's direct/dev/peer/optional dependencies.
 * Internal helper for ScanServiceImpl — not DI-registered.
 */
export class DependencyResolver {
    public constructor(private readonly registryCacheService: RegistryCacheService.Interface) {}

    public async resolveEntries(input: IResolveEntriesInput): Promise<IResolveEntriesResult> {
        const {
            entries,
            installedVersions,
            packageManager,
            force,
            project,
            onProgress,
            ageCutoff
        } = input;

        const results: Abstraction.Dependency[] = [];
        const registryData = new Map<string, Abstraction.RegistryData>();
        const total = entries.length;
        let processed = 0;

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

        return { results, registryData };
    }
}
