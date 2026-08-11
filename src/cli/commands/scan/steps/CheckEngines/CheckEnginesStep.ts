import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Logger } from "@webiny/stdlib";
import { CheckEnginesStep as Abstraction } from "./abstractions/CheckEnginesStep.js";
import { parseEnginesNode, classifyNodeVersion, NODE_RELEASES } from "#shared/engines/index.js";
import type { IEnginesFinding } from "#shared/engines/types.js";
import type { IDepcoConfig } from "#shared/config/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

const packageJsonSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    engines: z
        .object({
            node: z.string().optional()
        })
        .optional()
});

interface IPackageJsonInfo {
    name: string | undefined;
    version: string | undefined;
    enginesNode: string | null;
}

function readPackageJsonInfo(packageJsonPath: string): IPackageJsonInfo {
    const raw = readFileSync(packageJsonPath, "utf-8");
    const parsed = packageJsonSchema.parse(JSON.parse(raw));
    return {
        name: parsed.name,
        version: parsed.version,
        enginesNode: parsed.engines?.node ?? null
    };
}

interface IBuildFindingInput {
    packageName: string;
    version: string;
    enginesNode: string | null;
    isRoot: boolean;
}

function buildFinding(input: IBuildFindingInput): IEnginesFinding {
    const { packageName, version, enginesNode, isRoot } = input;
    const minimumMajor = enginesNode ? parseEnginesNode(enginesNode) : null;

    if (minimumMajor === null) {
        return {
            packageName,
            version,
            enginesNode,
            minimumMajor: null,
            status: "unknown",
            eolDate: null,
            isRoot
        };
    }

    const classification = classifyNodeVersion({
        majorVersion: minimumMajor,
        schedule: NODE_RELEASES
    });
    return {
        packageName,
        version,
        enginesNode,
        minimumMajor,
        status: classification.status,
        eolDate: classification.eolDate,
        isRoot
    };
}

interface IOnMalformedPackageInput {
    packageName: string;
    error: unknown;
}

interface IWalkContext {
    findings: IEnginesFinding[];
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

interface ICollectPackageInput {
    packageDirectory: string;
    packageName: string;
    context: IWalkContext;
}

function collectPackage(input: ICollectPackageInput): void {
    const { packageDirectory, packageName, context } = input;

    try {
        const info = readPackageJsonInfo(join(packageDirectory, "package.json"));
        context.findings.push(
            buildFinding({
                packageName: info.name ?? packageName,
                version: info.version ?? "",
                enginesNode: info.enginesNode,
                isRoot: false
            })
        );
    } catch (error) {
        context.onMalformedPackage({ packageName, error });
    }

    walkNodeModules({
        nodeModulesPath: join(packageDirectory, "node_modules"),
        context
    });
}

interface IWalkNodeModulesInput {
    nodeModulesPath: string;
    context: IWalkContext;
}

function walkNodeModules(input: IWalkNodeModulesInput): void {
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

interface IFilterIgnoredFindingsInput {
    findings: IEnginesFinding[];
    config: IDepcoConfig;
}

function filterIgnoredFindings(input: IFilterIgnoredFindingsInput): IEnginesFinding[] {
    const ignoredPackages = new Set([
        ...(input.config.scan?.engines?.ignore ?? []),
        ...(input.config.scan?.ignoredPackages ?? [])
    ]);
    return input.findings.filter(finding => !ignoredPackages.has(finding.packageName));
}

class CheckEnginesStepImpl implements Abstraction.Interface {
    public name = "check-engines";
    public description = "Check Node.js engine requirements for EOL and maintenance versions";

    public constructor(private readonly logger: Logger.Interface) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const check = context.options["check"] as string | undefined;
        if (check !== "engines" && check !== "all") {
            return { success: true, skipped: true, message: "engines check not requested" };
        }

        const config = (context.results.get("config") as IDepcoConfig | undefined) ?? {};

        const findings: IEnginesFinding[] = [this.readRootFinding(context.dataDirectory)];

        walkNodeModules({
            nodeModulesPath: join(context.dataDirectory, "node_modules"),
            context: {
                findings,
                visitedRealPaths: new Set<string>(),
                onMalformedPackage: ({ packageName, error }) => {
                    this.logger.warn(
                        "Failed to read engines.node for package during engines check",
                        {
                            packageName,
                            error: String(error)
                        }
                    );
                }
            }
        });

        const filtered = filterIgnoredFindings({ findings, config });

        context.results.set("engines", filtered);

        return {
            success: true,
            message: `Checked engines for ${filtered.length} package${filtered.length === 1 ? "" : "s"}`
        };
    }

    private readRootFinding(dataDirectory: string): IEnginesFinding {
        try {
            const info = readPackageJsonInfo(join(dataDirectory, "package.json"));
            return buildFinding({
                packageName: info.name ?? "",
                version: info.version ?? "",
                enginesNode: info.enginesNode,
                isRoot: true
            });
        } catch (error) {
            this.logger.warn("Failed to read root package.json during engines check", {
                dataDirectory,
                error: String(error)
            });
            return buildFinding({ packageName: "", version: "", enginesNode: null, isRoot: true });
        }
    }
}

export const CheckEnginesStep = Abstraction.createImplementation({
    implementation: CheckEnginesStepImpl,
    dependencies: [Logger]
});
