import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { LockfileParserService as Abstraction } from "./abstractions/LockfileParserService.js";

const NODE_MODULES_SEGMENT = "node_modules/";

const LOCKFILE_NAME_BY_PACKAGE_MANAGER: Record<string, string> = {
    npm: "package-lock.json",
    yarn: "yarn.lock",
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lock"
};

interface INpmPackageLockEntry {
    version?: string;
}

interface INpmPackageLockFile {
    packages?: Record<string, INpmPackageLockEntry>;
}

interface IRootPackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

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

function parsePackageLock(
    lockfileContent: string,
    rootPackageJsonContent: string
): Abstraction.DependencyEdge[] {
    let lockfile: INpmPackageLockFile;
    try {
        lockfile = JSON.parse(lockfileContent) as INpmPackageLockFile;
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
    const dependencyEdges: Abstraction.DependencyEdge[] = [];

    for (const [packagesKey, entry] of Object.entries(packages)) {
        // The root entry (key "") describes the project's own declared
        // dependencies, not an installed package — it is not an edge.
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

// --- Yarn ---------------------------------------------------------------

interface IYarnLockPackageEntry {
    packageName: string;
    version: string;
    dependencies: Record<string, string>;
}

interface IYarnLockParsedBlock {
    descriptors: string[];
    entry: IYarnLockPackageEntry;
}

interface IYarnLockQueueItem {
    entry: IYarnLockPackageEntry;
    depth: number;
}

function stripSurroundingQuotes(value: string): string {
    return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function parseYarnLockDescriptorHeader(headerLine: string): string[] {
    let header = headerLine.trim();
    if (header.endsWith(":")) {
        header = header.slice(0, -1);
    }
    header = stripSurroundingQuotes(header);

    return header
        .split(", ")
        .map(descriptor => stripSurroundingQuotes(descriptor.trim()))
        .filter(descriptor => descriptor.length > 0);
}

function extractYarnPackageName(descriptor: string): string {
    const isScoped = descriptor.startsWith("@");
    const atIndex = isScoped ? descriptor.indexOf("@", 1) : descriptor.indexOf("@");
    return atIndex === -1 ? descriptor : descriptor.slice(0, atIndex);
}

// Parses a single `key: value` (Berry, v2+) or `key value` (Classic v1,
// space-separated with no colon) field line into its [name, value] pair.
// Classic v1 quotes only the value ("1.20.2"); Berry quotes the value too
// but always separates name and value with a colon.
function parseYarnLockFieldLine(line: string): [string, string] | null {
    const trimmed = line.trim();

    const colonSeparated = /^"?([^":]+)"?:\s*(.+)$/.exec(trimmed);
    if (colonSeparated) {
        return [colonSeparated[1]!.trim(), stripSurroundingQuotes(colonSeparated[2]!.trim())];
    }

    const spaceSeparated = /^"?([^"]+?)"?\s+"([^"]*)"$/.exec(trimmed);
    if (spaceSeparated) {
        return [spaceSeparated[1]!.trim(), spaceSeparated[2]!.trim()];
    }

    return null;
}

function parseYarnLockBlock(block: string): IYarnLockParsedBlock | null {
    const lines = block.split(/\r?\n/).filter(line => line.trim() !== "");
    const headerLine = lines[0];
    if (!headerLine || headerLine.startsWith("#") || headerLine.trim() === "__metadata:") {
        return null;
    }

    const descriptors = parseYarnLockDescriptorHeader(headerLine);
    if (descriptors.length === 0) {
        return null;
    }

    const packageName = extractYarnPackageName(descriptors[0]!);
    let version = "";
    const dependencies: Record<string, string> = {};
    let insideDependencies = false;
    let dependenciesIndent = -1;

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]!;
        const indent = line.length - line.trimStart().length;

        if (insideDependencies && indent <= dependenciesIndent) {
            insideDependencies = false;
        }

        if (insideDependencies) {
            const field = parseYarnLockFieldLine(line);
            if (field) {
                dependencies[field[0]] = field[1];
            }
            continue;
        }

        const trimmedLine = line.trim();
        if (trimmedLine === "dependencies:") {
            insideDependencies = true;
            dependenciesIndent = indent;
            continue;
        }

        const field = parseYarnLockFieldLine(line);
        if (field && field[0] === "version") {
            version = field[1];
        }
    }

    return { descriptors, entry: { packageName, version, dependencies } };
}

// --- pnpm -----------------------------------------------------------------

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

// --- bun --------------------------------------------------------------------

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

class LockfileParserServiceImpl implements Abstraction.Interface {
    public async parse(
        projectPath: string,
        packageManager: string
    ): Promise<Abstraction.DependencyEdge[]> {
        const lockfileName = LOCKFILE_NAME_BY_PACKAGE_MANAGER[packageManager];
        if (!lockfileName) {
            return [];
        }

        let lockfileContent: string;
        try {
            lockfileContent = await readFile(join(projectPath, lockfileName), "utf-8");
        } catch {
            return [];
        }

        let rootPackageJsonContent: string;
        try {
            rootPackageJsonContent = await readFile(join(projectPath, "package.json"), "utf-8");
        } catch {
            rootPackageJsonContent = "{}";
        }

        switch (packageManager) {
            case "npm":
                return parsePackageLock(lockfileContent, rootPackageJsonContent);
            case "yarn":
                return this.parseYarnLock(lockfileContent, rootPackageJsonContent);
            case "pnpm":
                return this.parsePnpmLock(lockfileContent, rootPackageJsonContent);
            case "bun":
                return this.parseBunLock(lockfileContent, rootPackageJsonContent);
            default:
                return [];
        }
    }

    private parseYarnLock(
        lockfileContent: string,
        rootPackageJsonContent: string
    ): Abstraction.DependencyEdge[] {
        const blocks = lockfileContent.split(/\n\s*\n/);
        const descriptorToEntry = new Map<string, IYarnLockPackageEntry>();

        for (const block of blocks) {
            const parsedBlock = parseYarnLockBlock(block);
            if (!parsedBlock) {
                continue;
            }
            for (const descriptor of parsedBlock.descriptors) {
                descriptorToEntry.set(descriptor, parsedBlock.entry);
            }
        }

        let rootPackageJson: IRootPackageJson;
        try {
            rootPackageJson = JSON.parse(rootPackageJsonContent) as IRootPackageJson;
        } catch {
            rootPackageJson = {};
        }

        const devDependencyNames = new Set(Object.keys(rootPackageJson.devDependencies ?? {}));
        const rootDependencyRangesByName: Record<string, string> = {
            ...rootPackageJson.dependencies,
            ...rootPackageJson.devDependencies
        };

        const dependencyEdges: Abstraction.DependencyEdge[] = [];
        const visitedEntries = new Set<IYarnLockPackageEntry>();
        const queue: IYarnLockQueueItem[] = [];

        for (const [dependencyName, dependencyRange] of Object.entries(
            rootDependencyRangesByName
        )) {
            const entry =
                descriptorToEntry.get(`${dependencyName}@npm:${dependencyRange}`) ??
                descriptorToEntry.get(`${dependencyName}@${dependencyRange}`);
            if (!entry) {
                continue;
            }

            dependencyEdges.push({
                parentPackage: null,
                parentVersion: null,
                childPackage: entry.packageName,
                childVersion: entry.version,
                dependencyType: devDependencyNames.has(dependencyName)
                    ? "devDependency"
                    : "dependency",
                depth: 0
            });

            if (!visitedEntries.has(entry)) {
                visitedEntries.add(entry);
                queue.push({ entry, depth: 0 });
            }
        }

        while (queue.length > 0) {
            const { entry, depth } = queue.shift()!;

            for (const [dependencyName, dependencyRange] of Object.entries(entry.dependencies)) {
                const childEntry = descriptorToEntry.get(`${dependencyName}@${dependencyRange}`);
                if (!childEntry) {
                    continue;
                }

                dependencyEdges.push({
                    parentPackage: entry.packageName,
                    parentVersion: entry.version,
                    childPackage: childEntry.packageName,
                    childVersion: childEntry.version,
                    dependencyType: "dependency",
                    depth: depth + 1
                });

                if (!visitedEntries.has(childEntry)) {
                    visitedEntries.add(childEntry);
                    queue.push({ entry: childEntry, depth: depth + 1 });
                }
            }
        }

        return dependencyEdges;
    }

    private parsePnpmLock(
        lockfileContent: string,
        rootPackageJsonContent: string
    ): Abstraction.DependencyEdge[] {
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

        const dependencyEdges: Abstraction.DependencyEdge[] = [];
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

    private parseBunLock(
        lockfileContent: string,
        rootPackageJsonContent: string
    ): Abstraction.DependencyEdge[] {
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

        const dependencyEdges: Abstraction.DependencyEdge[] = [];
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

            const { packageName: parentPackage, version: parentVersion } = parseBunResolution(
                tuple[0]
            );
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
}

export const LockfileParserService = Abstraction.createImplementation({
    implementation: LockfileParserServiceImpl,
    dependencies: []
});
