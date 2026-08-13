import { readdir, readFile, access } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { globWorkspacePattern } from "#api/utils/globWorkspacePattern.js";

export interface IScanItem {
    name: string;
    path: string;
}

export interface IWorkspacesResult {
    patterns: string[];
    found: boolean;
}

export interface IScanRecursiveResult {
    items: IScanItem[];
    scannedCount: number;
}

const packageJsonWorkspacesSchema = z.object({
    workspaces: z
        .union([z.array(z.string()), z.object({ packages: z.array(z.string()).optional() })])
        .optional()
});

const SKIP_DIRECTORIES = new Set(["node_modules", ".git"]);

export async function readWorkspaces(dirPath: string): Promise<IWorkspacesResult> {
    try {
        const content = await readFile(join(dirPath, "package.json"), "utf-8");
        const pkg = packageJsonWorkspacesSchema.parse(JSON.parse(content));

        if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
            return { patterns: pkg.workspaces, found: true };
        }
        if (pkg.workspaces && !Array.isArray(pkg.workspaces)) {
            const packages = pkg.workspaces.packages;
            if (packages && packages.length > 0) {
                return { patterns: packages, found: true };
            }
        }
    } catch {
        // no package.json or parse error
    }
    return { patterns: [], found: false };
}

export async function resolveWorkspacePatterns(
    basePath: string,
    patterns: string[]
): Promise<IScanItem[]> {
    const includePatterns = patterns.filter(p => !p.startsWith("!"));
    const excludePatterns = patterns.filter(p => p.startsWith("!")).map(p => p.slice(1));

    const [includedSets, excludedSets] = await Promise.all([
        Promise.all(includePatterns.map(p => globWorkspacePattern(basePath, p))),
        Promise.all(excludePatterns.map(p => globWorkspacePattern(basePath, p)))
    ]);

    const excluded = new Set(excludedSets.flat());
    const locations = includedSets.flat().filter(loc => !excluded.has(loc));
    const unique = [...new Set(locations)];

    return unique
        .map(loc => ({
            name: loc.split("/").pop() ?? loc,
            path: join(basePath, loc)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function scanRecursive(
    basePath: string,
    maxDepth: number
): Promise<IScanRecursiveResult> {
    const items: IScanItem[] = [];
    let scannedCount = 0;

    async function walk(currentPath: string, currentDepth: number): Promise<void> {
        if (currentDepth > maxDepth) {
            return;
        }

        let entries;
        try {
            entries = await readdir(currentPath, { withFileTypes: true });
        } catch {
            return;
        }

        const subdirectories = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => !SKIP_DIRECTORIES.has(entry.name))
            .filter(entry => !entry.name.startsWith("."));

        scannedCount += subdirectories.length;

        for (const entry of subdirectories) {
            const entryPath = join(currentPath, entry.name);
            const pkgPath = join(entryPath, "package.json");

            try {
                await access(pkgPath);
                items.push({ name: entry.name, path: entryPath });
            } catch {
                // no package.json — recurse deeper if within depth
                if (currentDepth < maxDepth) {
                    await walk(entryPath, currentDepth + 1);
                }
            }
        }
    }

    await walk(basePath, 1);
    return { items, scannedCount };
}
