import type { IDependencyEdge } from "../abstractions/LockfileParserService.js";
import type { IRootPackageJson } from "./types.js";
import { rootPackageJsonSchema } from "./types.js";

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

export function parseYarnLockfile(
    lockfileContent: string,
    rootPackageJsonContent: string
): IDependencyEdge[] {
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
        rootPackageJson = rootPackageJsonSchema.parse(
            JSON.parse(rootPackageJsonContent)
        ) as IRootPackageJson;
    } catch {
        rootPackageJson = {};
    }

    const devDependencyNames = new Set(Object.keys(rootPackageJson.devDependencies ?? {}));
    const rootDependencyRangesByName: Record<string, string> = {
        ...rootPackageJson.dependencies,
        ...rootPackageJson.devDependencies
    };

    const dependencyEdges: IDependencyEdge[] = [];
    const visitedEntries = new Set<IYarnLockPackageEntry>();
    const queue: IYarnLockQueueItem[] = [];

    for (const [dependencyName, dependencyRange] of Object.entries(rootDependencyRangesByName)) {
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
            dependencyType: devDependencyNames.has(dependencyName) ? "devDependency" : "dependency",
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
