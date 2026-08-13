import { z } from "zod";
import { parse as parseYaml } from "yaml";
import type { IDependencyEdge } from "../abstractions/LockfileParserService.js";
import type { IRootPackageJson } from "./types.js";
import { rootPackageJsonSchema } from "./types.js";

const pnpmLockImporterDependencyEntrySchema = z.object({
    specifier: z.string(),
    version: z.string()
});

const pnpmLockImporterSchema = z.object({
    dependencies: z.record(z.string(), pnpmLockImporterDependencyEntrySchema).optional(),
    devDependencies: z.record(z.string(), pnpmLockImporterDependencyEntrySchema).optional()
});

const pnpmLockPackageEntrySchema = z.object({
    dependencies: z.record(z.string(), z.string()).optional()
});

const pnpmLockFileSchema = z.object({
    importers: z.record(z.string(), pnpmLockImporterSchema).optional(),
    packages: z.record(z.string(), pnpmLockPackageEntrySchema).optional()
});

type IPnpmLockFile = z.infer<typeof pnpmLockFileSchema>;

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
    let lockfile: IPnpmLockFile;
    try {
        const parsedYaml = parseYaml(lockfileContent);
        if (!parsedYaml) {
            return [];
        }
        const parsedLockfile = pnpmLockFileSchema.safeParse(parsedYaml);
        if (!parsedLockfile.success) {
            throw new Error(JSON.stringify(parsedLockfile.error.issues));
        }
        lockfile = parsedLockfile.data;
    } catch {
        return [];
    }

    let rootPackageJson: IRootPackageJson;
    try {
        const parsedRootPackageJson = rootPackageJsonSchema.safeParse(
            JSON.parse(rootPackageJsonContent)
        );
        if (!parsedRootPackageJson.success) {
            throw new Error(JSON.stringify(parsedRootPackageJson.error.issues));
        }
        rootPackageJson = parsedRootPackageJson.data as IRootPackageJson;
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
        const directDependencies: Record<string, { specifier: string; version: string }> = {
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
