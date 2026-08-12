import { mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { RegistryCacheService } from "../../RegistryCache/index.js";
import { LockfileParserService } from "../../DependencyGraph/index.js";
import { ScanService } from "../abstractions/ScanService.js";

export const REGISTRY_DATA: Record<string, RegistryCacheService.PackageInfo> = {
    react: {
        name: "react",
        latestVersion: "19.1.0",
        distTags: { latest: "19.1.0" },
        versions: ["18.2.0", "19.1.0"],
        time: {},
        repoUrl: null,
        repoDirectory: null,
        readme: null,
        license: null
    },
    vitest: {
        name: "vitest",
        latestVersion: "4.1.10",
        distTags: { latest: "4.1.10" },
        versions: ["4.0.0", "4.1.10"],
        time: {},
        repoUrl: null,
        repoDirectory: null,
        readme: null,
        license: null
    },
    lodash: {
        name: "lodash",
        latestVersion: "4.17.21",
        distTags: { latest: "4.17.21" },
        versions: ["4.17.21"],
        time: {},
        repoUrl: null,
        repoDirectory: null,
        readme: null,
        license: null
    },
    typescript: {
        name: "typescript",
        latestVersion: "7.0.2",
        distTags: { latest: "7.0.2" },
        versions: ["5.0.0", "7.0.2"],
        time: {},
        repoUrl: null,
        repoDirectory: null,
        readme: null,
        license: null
    }
};

export function makeEdge(params: {
    childPackage: string;
    childVersion: string;
    parentPackage?: string | null;
    parentVersion?: string | null;
    dependencyType?: string;
    depth?: number;
}): LockfileParserService.DependencyEdge {
    return {
        parentPackage: params.parentPackage ?? null,
        parentVersion: params.parentVersion ?? null,
        childPackage: params.childPackage,
        childVersion: params.childVersion,
        dependencyType: params.dependencyType ?? "dependency",
        depth: params.depth ?? 0
    };
}

export function makeWorkspaceLine(location: string, name: string | null): string {
    return JSON.stringify({ location, name });
}

export interface CreateServiceOptions {
    lockfileEdges?: LockfileParserService.DependencyEdge[];
    workspacesOutput?: string;
    getPackageInfoHandler?: RegistryCacheService.Interface["getPackageInfo"];
    onCommand?: (cmd: string, args: string[]) => void;
}

export function createTestDir(): string {
    const testDir = join(
        tmpdir(),
        `scan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    return testDir;
}

export function createService(options: CreateServiceOptions = {}): ScanService.Interface {
    const { container } = createTestApiContainer();

    const runHandler: CommandRunner.Interface["run"] = async (cmd, args, _opts) => {
        const argsArray = args ?? [];
        options.onCommand?.(cmd, argsArray);

        if (argsArray.includes("workspaces")) {
            return {
                stdout: options.workspacesOutput ?? makeWorkspaceLine(".", null),
                stderr: "",
                exitCode: 0
            };
        }

        return { stdout: "", stderr: "", exitCode: 0 };
    };

    container.registerInstance(CommandRunner, {
        run: runHandler,
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });

    container.registerInstance(RegistryCacheService, {
        getPackageInfo:
            options.getPackageInfoHandler ??
            (async (packageName: string) => {
                const info = REGISTRY_DATA[packageName];
                if (!info) {
                    throw new Error(`No registry data for ${packageName}`);
                }
                return info;
            }),
        clearAll: async () => {},
        clearPackage: async () => {}
    });

    container.registerInstance(LockfileParserService, {
        parse: async () => options.lockfileEdges ?? []
    });

    return container.resolve(ScanService);
}
