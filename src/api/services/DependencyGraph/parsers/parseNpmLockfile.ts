import { z } from "zod";
import type { IDependencyEdge } from "../abstractions/LockfileParserService.js";
import type { IRootPackageJson } from "./types.js";
import { rootPackageJsonSchema } from "./types.js";

const NODE_MODULES_SEGMENT = "node_modules/";

interface INpmPackageLockEntry {
    version?: string;
}

interface INpmPackageLockFile {
    packages?: Record<string, INpmPackageLockEntry>;
}

const npmPackageLockSchema = z.object({
    packages: z.record(z.string(), z.object({ version: z.string().optional() })).optional()
});

function extractPackageName(packagesKey: string): string {
    const lastSegmentIndex = packagesKey.lastIndexOf(NODE_MODULES_SEGMENT);
    return packagesKey.slice(lastSegmentIndex + NODE_MODULES_SEGMENT.length);
}

function extractParentKey(packagesKey: string): string | null {
    const lastSegmentIndex = packagesKey.lastIndexOf(NODE_MODULES_SEGMENT);
    const keyBeforeLastSegment = packagesKey.slice(0, lastSegmentIndex);
    if (keyBeforeLastSegment === "") {
        return null;
    }

    return keyBeforeLastSegment.endsWith("/")
        ? keyBeforeLastSegment.slice(0, -1)
        : keyBeforeLastSegment;
}

function countNodeModulesSegments(packagesKey: string): number {
    return packagesKey.split(NODE_MODULES_SEGMENT).length - 1;
}

export function parseNpmLockfile(
    lockfileContent: string,
    rootPackageJsonContent: string
): IDependencyEdge[] {
    let lockfile: INpmPackageLockFile;
    try {
        lockfile = npmPackageLockSchema.parse(JSON.parse(lockfileContent)) as INpmPackageLockFile;
    } catch {
        return [];
    }

    let rootPackageJson: IRootPackageJson;
    try {
        rootPackageJson = rootPackageJsonSchema.parse(
            JSON.parse(rootPackageJsonContent)
        ) as IRootPackageJson;
    } catch {
        rootPackageJson = {};
    }

    const devDependencyNames = new Set(Object.keys(rootPackageJson.devDependencies ?? {}));
    const packages = lockfile.packages ?? {};
    const dependencyEdges: IDependencyEdge[] = [];

    for (const [packagesKey, entry] of Object.entries(packages)) {
        if (packagesKey === "") {
            continue;
        }

        const depth = countNodeModulesSegments(packagesKey) - 1;
        const childPackage = extractPackageName(packagesKey);
        const childVersion = entry.version ?? "";

        const parentKey = extractParentKey(packagesKey);
        const parentPackage = parentKey === null ? null : extractPackageName(parentKey);
        const parentVersion = parentKey === null ? null : (packages[parentKey]?.version ?? null);

        const dependencyType =
            depth === 0 && devDependencyNames.has(childPackage) ? "devDependency" : "dependency";

        dependencyEdges.push({
            parentPackage,
            parentVersion,
            childPackage,
            childVersion,
            dependencyType,
            depth
        });
    }

    return dependencyEdges;
}
