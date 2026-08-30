import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { CommandRunner } from "../CommandRunner/index.js";
import { PackageManagerDriverRegistry } from "../PackageManager/abstractions/PackageManagerDriverRegistry.js";
import { globWorkspacePattern } from "../../utils/globWorkspacePattern.js";

export interface IWorkspaceEntry {
    location: string;
}

export interface IPackageJson {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
}

export type DependencyType =
    | "dependency"
    | "devDependency"
    | "peerDependency"
    | "optionalDependency";

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

// Minimal glob support for workspace patterns (e.g. "packages/*",
// "apps/**"). Only "*" (one segment) and "**" (zero or more segments) are
// npm/pnpm workspace discovery: read the `workspaces` field from the root
// package.json and glob each pattern. Yarn has its own dedicated command
// (`yarn workspaces list --json`) handled separately in collectWorkspaces.
async function collectWorkspacesFromPackageJson(projectPath: string): Promise<IWorkspaceEntry[]> {
    let patterns: string[] = [];
    try {
        const content = await readFile(join(projectPath, "package.json"), "utf-8");
        const parseResult = packageJsonSchema.safeParse(JSON.parse(content));
        if (parseResult.success) {
            const pkg = parseResult.data as IPackageJson;
            if (Array.isArray(pkg.workspaces)) {
                patterns = pkg.workspaces;
            } else if (pkg.workspaces?.packages) {
                patterns = pkg.workspaces.packages;
            }
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

/**
 * Workspace-aware discovery: resolving a project's workspace member
 * directories (via PM CLI or package.json glob fallback), reading their
 * package.json dependency sections, and collecting workspace package names
 * so they can be excluded from registry lookups. Internal helper for
 * ScanServiceImpl — not DI-registered.
 */
export class WorkspaceScanner {
    public constructor(
        private readonly commandRunner: CommandRunner.Interface,
        private readonly registry: PackageManagerDriverRegistry.Interface
    ) {}

    public async collectWorkspaces(
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

    public async collectDependencyTypes(
        projectPath: string,
        packageManager: string,
        signal?: AbortSignal
    ): Promise<Map<string, DependencyType>> {
        const types = new Map<string, DependencyType>();

        const workspaces = await this.collectWorkspaces(projectPath, packageManager, signal);

        const readResults = await Promise.all(
            workspaces.map(async workspace => {
                const packageJsonPath = join(projectPath, workspace.location, "package.json");
                try {
                    const content = await readFile(packageJsonPath, "utf-8");
                    const parseResult = packageJsonSchema.safeParse(JSON.parse(content));
                    return parseResult.success ? (parseResult.data as IPackageJson) : null;
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

    public async collectWorkspacePackageNames(
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
                const parseResult = packageJsonSchema.safeParse(JSON.parse(content));
                if (parseResult.success && parseResult.data.name) {
                    names.add(parseResult.data.name);
                }
            } catch {
                continue;
            }
        }
        return names;
    }
}
