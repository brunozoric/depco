import { parse as parseYaml } from "yaml";
import type { IDependencyEdge } from "../abstractions/LockfileParserService.js";
import type { IRootPackageJson } from "./types.js";

interface IPnpmLockImporterDependencyEntry {
    specifier: string;
    version: string;
}

interface IPnpmLockImporter {
    dependencies?: Record<string, IPnpmLockImporterDependencyEntry>;
    devDependencies?: Record<string, IPnpmLockImporterDependencyEntry>;
}

interface IPnpmLockPackageEntry {
    dependencies?: Record<string, string>;
}

interface IPnpmLockFile {
    importers?: Record<string, IPnpmLockImporter>;
    packages?: Record<string, IPnpmLockPackageEntry>;
}

interface IPnpmLockQueueItem {
    packageKey: string;
    depth: number;
}

function extractPnpmPackageName(packageKey: string): string {
    const lastAtIndex = packageKey.lastIndexOf("@");
    return lastAtIndex <= 0 ? packageKey : packageKey.slice(0, lastAtIndex);
}

function extractPnpmPackageVersion(packageKey: string): string {
    const lastAtIndex = packageKey.lastIndexOf("@");
    return lastAtIndex <= 0 ? "" : packageKey.slice(lastAtIndex + 1);
}

export function parsePnpmLockfile(
    lockfileContent: string,
    rootPackageJsonContent: string
): IDependencyEdge[] {
    let lockfile: IPnpmLockFile | null;
    try {
        lockfile = parseYaml(lockfileContent) as IPnpmLockFile | null;
    } catch {
        return [];
    }
    if (!lockfile) {
        return [];
    }

    let rootPackageJson: IRootPackageJson;
    try {
        rootPackageJson = JSON.parse(rootPackageJsonContent) as IRootPackageJson;
    } catch {
        rootPackageJson = {};
    }

    const devDependencyNames = new Set(Object.keys(rootPackageJson.devDependencies ?? {}));
    const packages = lockfile.packages ?? {};
    const importers = lockfile.importers ?? {};

    const dependencyEdges: IDependencyEdge[] = [];
    const visitedPackageKeys = new Set<string>();
    const queue: IPnpmLockQueueItem[] = [];

    for (const importer of Object.values(importers)) {
        const directDependencies: Record<string, IPnpmLockImporterDependencyEntry> = {
            ...importer.dependencies,
            ...importer.devDependencies
        };

        for (const [dependencyName, dependencyEntry] of Object.entries(directDependencies)) {
            const packageKey = `${dependencyName}@${dependencyEntry.version}`;

            dependencyEdges.push({
                parentPackage: null,
                parentVersion: null,
                childPackage: dependencyName,
                childVersion: dependencyEntry.version,
                dependencyType: devDependencyNames.has(dependencyName)
                    ? "devDependency"
                    : "dependency",
                depth: 0
            });

            if (!visitedPackageKeys.has(packageKey)) {
                visitedPackageKeys.add(packageKey);
                queue.push({ packageKey, depth: 0 });
            }
        }
    }

    while (queue.length > 0) {
        const { packageKey, depth } = queue.shift()!;
        const entry = packages[packageKey];
        if (!entry) {
            continue;
        }

        const parentPackage = extractPnpmPackageName(packageKey);
        const parentVersion = extractPnpmPackageVersion(packageKey);

        for (const [dependencyName, dependencyVersion] of Object.entries(
            entry.dependencies ?? {}
        )) {
            const childPackageKey = `${dependencyName}@${dependencyVersion}`;

            dependencyEdges.push({
                parentPackage,
                parentVersion,
                childPackage: dependencyName,
                childVersion: dependencyVersion,
                dependencyType: "dependency",
                depth: depth + 1
            });

            if (!visitedPackageKeys.has(childPackageKey)) {
                visitedPackageKeys.add(childPackageKey);
                queue.push({ packageKey: childPackageKey, depth: depth + 1 });
            }
        }
    }

    return dependencyEdges;
}
