import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Logger } from "@webiny/stdlib";
import { CheckEnginesStep as Abstraction } from "./abstractions/CheckEnginesStep.js";
import {
    parseEnginesNode,
    classifyNodeVersion,
    NODE_RELEASES,
    walkNodeModules as walkNodeModulesShared
} from "#shared/engines/index.js";
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

        const walkedPackages = walkNodeModulesShared({
            nodeModulesPath: join(context.dataDirectory, "node_modules"),
            onMalformedPackage: ({ packageName, error }) => {
                this.logger.warn("Failed to read engines.node for package during engines check", {
                    packageName,
                    error: String(error)
                });
            }
        });

        const findings: IEnginesFinding[] = [this.readRootFinding(context.dataDirectory)];
        for (const [packageName, entry] of walkedPackages) {
            findings.push(
                buildFinding({
                    packageName,
                    version: "",
                    enginesNode: entry.enginesNode,
                    isRoot: false
                })
            );
        }

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
