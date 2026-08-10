import type { IDependencyEdge } from "../abstractions/LockfileParserService.js";
import type { IRootPackageJson } from "./types.js";

interface IBunLockWorkspace {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

interface IBunLockPackageMetadata {
    dependencies?: Record<string, string>;
}

type BunLockPackageTuple = [string, IBunLockPackageMetadata?];

interface IBunLockFile {
    workspaces?: Record<string, IBunLockWorkspace>;
    packages?: Record<string, BunLockPackageTuple>;
}

interface IBunLockResolution {
    packageName: string;
    version: string;
}

interface IBunLockQueueItem {
    packageKey: string;
    depth: number;
}

function stripJsonComments(content: string): string {
    return content
        .split(/\r?\n/)
        .map(line => (line.trim().startsWith("//") ? "" : line))
        .join("\n");
}

function parseBunResolution(resolution: string): IBunLockResolution {
    const isScoped = resolution.startsWith("@");
    const atIndex = isScoped ? resolution.indexOf("@", 1) : resolution.indexOf("@");
    if (atIndex === -1) {
        return { packageName: resolution, version: "" };
    }
    return { packageName: resolution.slice(0, atIndex), version: resolution.slice(atIndex + 1) };
}

export function parseBunLockfile(
    lockfileContent: string,
    rootPackageJsonContent: string
): IDependencyEdge[] {
    let lockfile: IBunLockFile;
    try {
        lockfile = JSON.parse(stripJsonComments(lockfileContent)) as IBunLockFile;
    } catch {
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
    const workspaces = lockfile.workspaces ?? {};

    const dependencyEdges: IDependencyEdge[] = [];
    const visitedPackageKeys = new Set<string>();
    const queue: IBunLockQueueItem[] = [];

    for (const workspace of Object.values(workspaces)) {
        const directDependencyNames = new Set([
            ...Object.keys(workspace.dependencies ?? {}),
            ...Object.keys(workspace.devDependencies ?? {})
        ]);

        for (const dependencyName of directDependencyNames) {
            const tuple = packages[dependencyName];
            if (!tuple) {
                continue;
            }

            const { version } = parseBunResolution(tuple[0]);

            dependencyEdges.push({
                parentPackage: null,
                parentVersion: null,
                childPackage: dependencyName,
                childVersion: version,
                dependencyType: devDependencyNames.has(dependencyName)
                    ? "devDependency"
                    : "dependency",
                depth: 0
            });

            if (!visitedPackageKeys.has(dependencyName)) {
                visitedPackageKeys.add(dependencyName);
                queue.push({ packageKey: dependencyName, depth: 0 });
            }
        }
    }

    while (queue.length > 0) {
        const { packageKey, depth } = queue.shift()!;
        const tuple = packages[packageKey];
        if (!tuple) {
            continue;
        }

        const { packageName: parentPackage, version: parentVersion } = parseBunResolution(tuple[0]);
        const metadata = tuple[1];

        for (const dependencyName of Object.keys(metadata?.dependencies ?? {})) {
            const childTuple = packages[dependencyName];
            if (!childTuple) {
                continue;
            }

            const { version: childVersion } = parseBunResolution(childTuple[0]);

            dependencyEdges.push({
                parentPackage,
                parentVersion,
                childPackage: dependencyName,
                childVersion,
                dependencyType: "dependency",
                depth: depth + 1
            });

            if (!visitedPackageKeys.has(dependencyName)) {
                visitedPackageKeys.add(dependencyName);
                queue.push({ packageKey: dependencyName, depth: depth + 1 });
            }
        }
    }

    return dependencyEdges;
}
