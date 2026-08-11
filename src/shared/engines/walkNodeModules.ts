import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export interface INodeModulesPackageEntry {
    packageName: string;
    enginesNode: string | null;
}

export interface IOnMalformedPackageInput {
    packageName: string;
    error: unknown;
}

export interface IWalkNodeModulesInput {
    nodeModulesPath: string;
    onMalformedPackage?: (input: IOnMalformedPackageInput) => void;
}

const packageJsonEnginesSchema = z.object({
    engines: z
        .object({
            node: z.string().optional()
        })
        .optional()
});

interface IWalkContext {
    entriesByPackageName: Map<string, INodeModulesPackageEntry>;
    visitedRealPaths: Set<string>;
    onMalformedPackage: (input: IOnMalformedPackageInput) => void;
}

function isTraversableDirectory(entry: Dirent, parentPath: string): boolean {
    if (entry.isDirectory()) {
        return true;
    }
    if (!entry.isSymbolicLink()) {
        return false;
    }
    try {
        return statSync(join(parentPath, entry.name)).isDirectory();
    } catch {
        return false;
    }
}

interface IReadEnginesNodeInput {
    packageJsonPath: string;
}

function readEnginesNode(input: IReadEnginesNodeInput): string | null {
    const raw = readFileSync(input.packageJsonPath, "utf-8");
    const parsed = packageJsonEnginesSchema.parse(JSON.parse(raw));
    return parsed.engines?.node ?? null;
}

interface ICollectPackageInput {
    packageDirectory: string;
    packageName: string;
    context: IWalkContext;
}

function collectPackage(input: ICollectPackageInput): void {
    const { packageDirectory, packageName, context } = input;

    try {
        const enginesNode = readEnginesNode({
            packageJsonPath: join(packageDirectory, "package.json")
        });
        context.entriesByPackageName.set(packageName, { packageName, enginesNode });
    } catch (error) {
        context.onMalformedPackage({ packageName, error });
        context.entriesByPackageName.set(packageName, { packageName, enginesNode: null });
    }

    walkRecursive({
        nodeModulesPath: join(packageDirectory, "node_modules"),
        context
    });
}

interface IWalkRecursiveInput {
    nodeModulesPath: string;
    context: IWalkContext;
}

function walkRecursive(input: IWalkRecursiveInput): void {
    const { nodeModulesPath, context } = input;

    let resolvedPath: string;
    try {
        resolvedPath = realpathSync(nodeModulesPath);
    } catch {
        return;
    }
    if (context.visitedRealPaths.has(resolvedPath)) {
        return;
    }
    context.visitedRealPaths.add(resolvedPath);

    let directoryEntries: Dirent[];
    try {
        directoryEntries = readdirSync(nodeModulesPath, { withFileTypes: true });
    } catch {
        return;
    }

    for (const directoryEntry of directoryEntries) {
        if (directoryEntry.name === ".bin") {
            continue;
        }
        if (!isTraversableDirectory(directoryEntry, nodeModulesPath)) {
            continue;
        }

        if (directoryEntry.name.startsWith("@")) {
            const scopeDirectory = join(nodeModulesPath, directoryEntry.name);
            let scopedEntries: Dirent[];
            try {
                scopedEntries = readdirSync(scopeDirectory, { withFileTypes: true });
            } catch {
                continue;
            }
            for (const scopedEntry of scopedEntries) {
                if (!isTraversableDirectory(scopedEntry, scopeDirectory)) {
                    continue;
                }
                collectPackage({
                    packageDirectory: join(scopeDirectory, scopedEntry.name),
                    packageName: `${directoryEntry.name}/${scopedEntry.name}`,
                    context
                });
            }
            continue;
        }

        collectPackage({
            packageDirectory: join(nodeModulesPath, directoryEntry.name),
            packageName: directoryEntry.name,
            context
        });
    }
}

export function walkNodeModules(
    input: IWalkNodeModulesInput
): Map<string, INodeModulesPackageEntry> {
    const entriesByPackageName = new Map<string, INodeModulesPackageEntry>();
    const context: IWalkContext = {
        entriesByPackageName,
        visitedRealPaths: new Set<string>(),
        onMalformedPackage: input.onMalformedPackage ?? (() => {})
    };

    walkRecursive({
        nodeModulesPath: input.nodeModulesPath,
        context
    });

    return entriesByPackageName;
}
