import { readdir, readFile, realpath, access } from "fs/promises";
import { resolve, join } from "path";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { browseFilesystemRoute, scanFilesystemRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "../db/abstractions/DatabaseClient.js";
import { projects } from "../db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container?: Container;
}

interface IScanItem {
    name: string;
    path: string;
}

interface IWorkspacesResult {
    patterns: string[];
    found: boolean;
}

interface IPackageJsonWorkspaces {
    workspaces?: string[] | { packages?: string[] };
}

interface IScanRecursiveResult {
    items: IScanItem[];
    scannedCount: number;
}

const SKIP_DIRECTORIES = new Set(["node_modules", ".git"]);

async function readWorkspaces(dirPath: string): Promise<IWorkspacesResult> {
    try {
        const content = await readFile(join(dirPath, "package.json"), "utf-8");
        const pkg = JSON.parse(content) as IPackageJsonWorkspaces;

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

// Minimal workspace glob — supports "*" (one segment) and "**" (zero or
// more segments). No external glob dependency needed.
async function globWorkspacePattern(root: string, pattern: string): Promise<string[]> {
    const segments = pattern.split("/").filter(Boolean);

    async function resolveSegments(
        baseAbs: string,
        baseRel: string,
        remaining: string[]
    ): Promise<string[]> {
        if (remaining.length === 0) {
            try {
                await access(join(baseAbs, "package.json"));
                return [baseRel];
            } catch {
                return [];
            }
        }

        const [segment, ...rest] = remaining;

        if (segment === "**") {
            const results = await resolveSegments(baseAbs, baseRel, rest);
            let entries;
            try {
                entries = await readdir(baseAbs, { withFileTypes: true });
            } catch {
                return results;
            }
            for (const entry of entries) {
                if (
                    !entry.isDirectory() ||
                    SKIP_DIRECTORIES.has(entry.name) ||
                    entry.name.startsWith(".")
                ) {
                    continue;
                }
                const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
                results.push(
                    ...(await resolveSegments(join(baseAbs, entry.name), childRel, remaining))
                );
            }
            return results;
        }

        if (segment === "*") {
            let entries;
            try {
                entries = await readdir(baseAbs, { withFileTypes: true });
            } catch {
                return [];
            }
            const results: string[] = [];
            for (const entry of entries) {
                if (
                    !entry.isDirectory() ||
                    SKIP_DIRECTORIES.has(entry.name) ||
                    entry.name.startsWith(".")
                ) {
                    continue;
                }
                const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
                results.push(...(await resolveSegments(join(baseAbs, entry.name), childRel, rest)));
            }
            return results;
        }

        const childRel = baseRel ? `${baseRel}/${segment}` : (segment as string);
        return resolveSegments(join(baseAbs, segment as string), childRel, rest);
    }

    return resolveSegments(root, "", segments);
}

async function resolveWorkspacePatterns(
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

async function scanRecursive(basePath: string, maxDepth: number): Promise<IScanRecursiveResult> {
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

export async function filesystemRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    // GET /api/filesystem/browse — list directories at a given path
    // (defaults to cwd), used by the folder browser UI.
    registerRoute(app, browseFilesystemRoute, {}, async (request, reply) => {
        const rawPath = request.query.path ?? process.cwd();
        const showHidden = request.query.showHidden === "true";

        let resolvedPath: string;
        try {
            resolvedPath = await realpath(resolve(rawPath));
        } catch {
            sendError({
                reply: reply,
                statusCode: 400,
                message: `Path does not exist: ${rawPath}`
            });
            return;
        }

        let entries;
        try {
            entries = await readdir(resolvedPath, { withFileTypes: true });
        } catch {
            sendError({
                reply: reply,
                statusCode: 400,
                message: `Cannot read directory: ${resolvedPath}`
            });
            return;
        }

        const directories = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => showHidden || !entry.name.startsWith("."))
            .map(entry => ({
                name: entry.name,
                path: join(resolvedPath, entry.name),
                type: "directory" as const
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        reply.send({
            items: directories,
            total: directories.length,
            currentPath: resolvedPath
        });
    });

    // GET /api/filesystem/scan — scan for subdirectories containing package.json.
    // Tries workspace resolution (package.json "workspaces" field) first; falls
    // back to a recursive scan up to the requested depth, excluding
    // node_modules/.git/hidden dirs and already-registered projects.
    registerRoute(app, scanFilesystemRoute, {}, async (request, reply) => {
        const rawPath = request.query.path;
        const depth = Math.min(request.query.depth, 5);

        let resolvedPath: string;
        try {
            resolvedPath = await realpath(resolve(rawPath));
        } catch {
            sendError({
                reply: reply,
                statusCode: 400,
                message: `Path does not exist: ${rawPath}`
            });
            return;
        }

        let existingPaths = new Set<string>();
        if (options.container) {
            const databaseClient = options.container.resolve(DatabaseClient);
            const rows = await databaseClient.db
                .select({ path: projects.path })
                .from(projects)
                .all();
            existingPaths = new Set(rows.map(row => row.path));
        }

        // Try workspace resolution first.
        const workspaces = await readWorkspaces(resolvedPath);
        if (workspaces.found) {
            const workspaceItems = await resolveWorkspacePatterns(
                resolvedPath,
                workspaces.patterns
            );

            if (workspaceItems.length > 0) {
                const filtered = workspaceItems
                    .filter(item => !existingPaths.has(item.path))
                    .sort((a, b) => a.name.localeCompare(b.name));

                reply.send({
                    items: filtered,
                    total: filtered.length,
                    scannedPath: resolvedPath,
                    scannedCount: workspaceItems.length,
                    filteredCount: filtered.length,
                    mode: "workspaces" as const
                });
                return;
            }
            // Workspaces declared but resolved to nothing — fall through to depth scan.
        }

        const scanResult = await scanRecursive(resolvedPath, depth);

        const filtered = scanResult.items
            .filter(item => !existingPaths.has(item.path))
            .sort((a, b) => a.name.localeCompare(b.name));

        reply.send({
            items: filtered,
            total: filtered.length,
            scannedPath: resolvedPath,
            scannedCount: scanResult.scannedCount,
            filteredCount: filtered.length,
            mode: "depth" as const
        });
    });
}
