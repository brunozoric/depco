import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../CommandRunner/index.js";
import { RegistryCacheService } from "../RegistryCache/index.js";
import { LockfileParserService } from "../../abstractions/LockfileParserService.js";
import { ScanService } from "../abstractions/ScanService.js";
import { ScanService as ScanServiceRegistration } from "../ScanService.js";
import { PackageManagerDriverRegistry as RegistryRegistration } from "../../packageManagers/PackageManagerDriverRegistry.js";

const REGISTRY_DATA: Record<string, RegistryCacheService.PackageInfo> = {
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

function makeEdge(params: {
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

function makeWorkspaceLine(location: string, name: string | null): string {
    return JSON.stringify({ location, name });
}

interface CreateServiceOptions {
    lockfileEdges?: LockfileParserService.DependencyEdge[];
    workspacesOutput?: string;
    getPackageInfoHandler?: RegistryCacheService.Interface["getPackageInfo"];
    onCommand?: (cmd: string, args: string[]) => void;
}

function createTestDir(): string {
    const testDir = join(
        tmpdir(),
        `scan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    return testDir;
}

function createService(options: CreateServiceOptions = {}): ScanService.Interface {
    const container = createContainer();

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

    container.register(RegistryRegistration).inSingletonScope();
    container.register(ScanServiceRegistration);
    return container.resolve(ScanService);
}

describe("ScanService", () => {
    it("scans all workspace dependencies and returns them with upgrade classification", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    dependencies: { react: "^18.2.0" },
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" }),
                makeEdge({
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    parentPackage: "react",
                    parentVersion: "18.2.0",
                    depth: 1
                })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(3);

            const react = deps.find(d => d.name === "react");
            expect(react).toBeDefined();
            expect(react!.currentVersion).toBe("18.2.0");
            expect(react!.latestVersion).toBe("19.1.0");
            expect(react!.dependencyKind).toBe("dependency");
            expect(react!.registryResolved).toBe(true);
            expect(react!.upgradeType).toBe("major");

            const vitest = deps.find(d => d.name === "vitest");
            expect(vitest).toBeDefined();
            expect(vitest!.currentVersion).toBe("4.0.0");
            expect(vitest!.latestVersion).toBe("4.1.10");
            expect(vitest!.dependencyKind).toBe("devDependency");
            expect(vitest!.registryResolved).toBe(true);
            expect(vitest!.upgradeType).toBe("minor");

            const lodash = deps.find(d => d.name === "lodash");
            expect(lodash).toBeDefined();
            expect(lodash!.dependencyKind).toBe("transitive");
            expect(lodash!.registryResolved).toBe(false);
            expect(lodash!.latestVersion).toBeNull();
            expect(lodash!.upgradeType).toBeNull();
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("includes dependencies that are already at latest version with upgradeType none", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0", lodash: "^4.17.21" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "lodash", childVersion: "4.17.21" })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(2);

            const react = deps.find(d => d.name === "react");
            expect(react!.upgradeType).toBe("major");

            const lodash = deps.find(d => d.name === "lodash");
            expect(lodash!.upgradeType).toBe("none");
            expect(lodash!.currentVersion).toBe("4.17.21");
            expect(lodash!.latestVersion).toBe("4.17.21");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("collects dependencies from multiple workspaces", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    dependencies: { react: "^18.2.0" }
                })
            );

            mkdirSync(join(testDir, "packages/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/app/package.json"),
                JSON.stringify({
                    name: "@test/app",
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const workspacesOutput = [
                makeWorkspaceLine(".", null),
                makeWorkspaceLine("packages/app", "@test/app")
            ].join("\n");

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" })
            ];

            const service = createService({ lockfileEdges, workspacesOutput });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(2);
            expect(deps.find(d => d.name === "react")).toBeDefined();
            expect(deps.find(d => d.name === "vitest")).toBeDefined();
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("excludes workspace packages from installed versions", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    dependencies: { react: "^18.2.0" }
                })
            );

            mkdirSync(join(testDir, "packages/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/app/package.json"),
                JSON.stringify({
                    name: "@test/app",
                    dependencies: { react: "^18.0.0" }
                })
            );

            const workspacesOutput = [
                makeWorkspaceLine(".", null),
                makeWorkspaceLine("packages/app", "@test/app")
            ].join("\n");

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "@test/app", childVersion: "0.0.0" })
            ];

            const service = createService({ lockfileEdges, workspacesOutput });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("react");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("deduplicates dependencies across workspaces, keeping first type seen", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    dependencies: { react: "^18.2.0" }
                })
            );

            mkdirSync(join(testDir, "packages/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/app/package.json"),
                JSON.stringify({
                    name: "@test/app",
                    devDependencies: { react: "^18.0.0" }
                })
            );

            const workspacesOutput = [
                makeWorkspaceLine(".", null),
                makeWorkspaceLine("packages/app", "@test/app")
            ].join("\n");

            const lockfileEdges = [makeEdge({ childPackage: "react", childVersion: "18.2.0" })];

            const service = createService({ lockfileEdges, workspacesOutput });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.dependencyKind).toBe("dependency");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("returns all dependencies even when none are upgradeable", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "empty",
                    dependencies: { lodash: "^4.17.21" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "lodash", childVersion: "4.17.21" })];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("lodash");
            expect(deps[0]!.upgradeType).toBe("none");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("passes the force flag through to the registry cache service", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "react", childVersion: "18.2.0" })];
            const receivedForceValues: Array<boolean | undefined> = [];

            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async (
                    packageName: string,
                    _packageManager: string,
                    force?: boolean
                ) => {
                    receivedForceValues.push(force);
                    const info = REGISTRY_DATA[packageName];
                    if (!info) {
                        throw new Error(`No registry data for ${packageName}`);
                    }
                    return info;
                }
            });

            await service.scan(testDir, "yarn", true);

            expect(receivedForceValues).toEqual([true]);
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("handles concurrent lookups in batches", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0", typescript: "^5.0.0" },
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "typescript", childVersion: "5.0.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" })
            ];

            const lookedUp: string[] = [];
            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async (packageName: string) => {
                    lookedUp.push(packageName);
                    const info = REGISTRY_DATA[packageName];
                    if (!info) {
                        throw new Error(`No registry data for ${packageName}`);
                    }
                    return info;
                }
            });

            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(3);
            expect(lookedUp).toHaveLength(3);
            expect(new Set(lookedUp).size).toBe(3);
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("calls onProgress after each registry lookup with cumulative current/total counts", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0", typescript: "^5.0.0" },
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "typescript", childVersion: "5.0.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" })
            ];

            const service = createService({ lockfileEdges });
            const progressCalls: Array<[string, number, number]> = [];

            await service.scan(testDir, "yarn", false, (packageName, current, total) => {
                progressCalls.push([packageName, current, total]);
            });

            expect(progressCalls).toHaveLength(3);
            for (const [, , total] of progressCalls) {
                expect(total).toBe(3);
            }
            const currents = progressCalls.map(([, current]) => current).sort();
            expect(currents).toEqual([1, 2, 3]);
            const namesReported = new Set(progressCalls.map(([name]) => name));
            expect(namesReported).toEqual(new Set(["react", "typescript", "vitest"]));
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("works with npm projects using lockfile edges", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0" },
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" }),
                makeEdge({
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    parentPackage: "react",
                    parentVersion: "18.2.0",
                    depth: 1
                })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(3);
            expect(deps.find(d => d.name === "react")?.latestVersion).toBe("19.1.0");
            expect(deps.find(d => d.name === "vitest")?.latestVersion).toBe("4.1.10");
            expect(deps.find(d => d.name === "lodash")?.dependencyKind).toBe("transitive");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("works with pnpm projects using lockfile edges", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0" },
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "pnpm");

            expect(deps).toHaveLength(2);
            expect(deps.find(d => d.name === "react")?.latestVersion).toBe("19.1.0");
            expect(deps.find(d => d.name === "vitest")?.latestVersion).toBe("4.1.10");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("keeps the shallowest version when a package appears at multiple depths", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0", depth: 0 }),
                makeEdge({
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    parentPackage: "react",
                    parentVersion: "18.2.0",
                    depth: 1
                }),
                makeEdge({
                    childPackage: "lodash",
                    childVersion: "3.10.0",
                    parentPackage: "other",
                    parentVersion: "1.0.0",
                    depth: 2
                })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(2);
            const lodash = deps.find(d => d.name === "lodash");
            expect(lodash).toBeDefined();
            expect(lodash!.currentVersion).toBe("4.17.21");
            expect(lodash!.dependencyKind).toBe("transitive");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("discovers npm/pnpm workspaces via a `*` glob pattern over real directories", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    workspaces: ["packages/*"],
                    dependencies: { react: "^18.2.0" }
                })
            );

            mkdirSync(join(testDir, "packages/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/app/package.json"),
                JSON.stringify({
                    name: "@test/app",
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            mkdirSync(join(testDir, "packages/lib"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/lib/package.json"),
                JSON.stringify({
                    name: "@test/lib",
                    dependencies: { typescript: "^5.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" }),
                makeEdge({ childPackage: "typescript", childVersion: "5.0.0" })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(3);
            expect(deps.find(d => d.name === "react")?.dependencyKind).toBe("dependency");
            expect(deps.find(d => d.name === "vitest")?.dependencyKind).toBe("devDependency");
            expect(deps.find(d => d.name === "typescript")?.dependencyKind).toBe("dependency");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("discovers npm/pnpm workspaces at arbitrary depth via a `**` glob pattern", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    workspaces: ["packages/**"]
                })
            );

            mkdirSync(join(testDir, "packages/lib"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/lib/package.json"),
                JSON.stringify({
                    name: "@test/lib",
                    dependencies: { typescript: "^5.0.0" }
                })
            );

            mkdirSync(join(testDir, "packages/group/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/group/app/package.json"),
                JSON.stringify({
                    name: "@test/group-app",
                    devDependencies: { vitest: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "typescript", childVersion: "5.0.0" }),
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(2);
            expect(deps.find(d => d.name === "typescript")).toBeDefined();
            expect(deps.find(d => d.name === "vitest")).toBeDefined();
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("reads the object form of the workspaces field (`{ packages: [...] }`)", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    workspaces: { packages: ["packages/*"] }
                })
            );

            mkdirSync(join(testDir, "packages/app"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/app/package.json"),
                JSON.stringify({
                    name: "@test/app",
                    dependencies: { typescript: "^5.0.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "typescript", childVersion: "5.0.0" })];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("typescript");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("classifies peerDependencies from package.json", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    peerDependencies: { react: "^18.2.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "react", childVersion: "18.2.0" })];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("react");
            expect(deps[0]!.dependencyKind).toBe("peerDependency");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("classifies optionalDependencies from package.json", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    optionalDependencies: { lodash: "^4.17.21" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "lodash", childVersion: "4.17.21" })];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("lodash");
            expect(deps[0]!.dependencyKind).toBe("optionalDependency");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("includes transitive dependencies in scan results with null registry data", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { react: "^18.2.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "react", childVersion: "18.2.0" }),
                makeEdge({
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    parentPackage: "react",
                    parentVersion: "18.2.0",
                    depth: 1
                })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(2);

            const react = deps.find(d => d.name === "react");
            expect(react).toBeDefined();
            expect(react!.dependencyKind).toBe("dependency");
            expect(react!.registryResolved).toBe(true);
            expect(react!.latestVersion).toBe("19.1.0");
            expect(react!.upgradeType).toBe("major");

            const lodash = deps.find(d => d.name === "lodash");
            expect(lodash).toBeDefined();
            expect(lodash!.dependencyKind).toBe("transitive");
            expect(lodash!.registryResolved).toBe(false);
            expect(lodash!.latestVersion).toBeNull();
            expect(lodash!.latestInRange).toBeNull();
            expect(lodash!.upgradeType).toBeNull();
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("excludes workspaces matched by a `!`-prefixed exclusion pattern", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "root",
                    workspaces: ["packages/*", "!packages/excluded"]
                })
            );

            mkdirSync(join(testDir, "packages/included"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/included/package.json"),
                JSON.stringify({
                    name: "@test/included",
                    dependencies: { vitest: "^4.0.0" }
                })
            );

            mkdirSync(join(testDir, "packages/excluded"), { recursive: true });
            writeFileSync(
                join(testDir, "packages/excluded/package.json"),
                JSON.stringify({
                    name: "@test/excluded",
                    dependencies: { typescript: "^5.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "vitest", childVersion: "4.0.0" }),
                makeEdge({ childPackage: "typescript", childVersion: "5.0.0" })
            ];

            const service = createService({ lockfileEdges });
            const { dependencies: deps } = await service.scan(testDir, "npm");

            expect(deps).toHaveLength(2);
            const vitest = deps.find(d => d.name === "vitest");
            expect(vitest).toBeDefined();
            expect(vitest!.dependencyKind).toBe("dependency");
            expect(vitest!.registryResolved).toBe(true);

            const typescript = deps.find(d => d.name === "typescript");
            expect(typescript).toBeDefined();
            expect(typescript!.dependencyKind).toBe("transitive");
            expect(typescript!.registryResolved).toBe(false);
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("classifies an upgrade as patch when only the patch version differs", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { patchpkg: "^1.0.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "patchpkg", childVersion: "1.0.0" })];

            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async () => ({
                    name: "patchpkg",
                    latestVersion: "1.0.1",
                    distTags: { latest: "1.0.1" },
                    versions: ["1.0.0", "1.0.1"],
                    time: {},
                    repoUrl: null,
                    repoDirectory: null,
                    readme: null,
                    license: null
                })
            });

            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.currentVersion).toBe("1.0.0");
            expect(deps[0]!.latestVersion).toBe("1.0.1");
            expect(deps[0]!.upgradeType).toBe("patch");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("treats a registry latest older than current as none (prevents downgrades)", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { downgradepkg: "^4.0.0" }
                })
            );

            const lockfileEdges = [
                makeEdge({ childPackage: "downgradepkg", childVersion: "4.0.12" })
            ];

            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async () => ({
                    name: "downgradepkg",
                    latestVersion: "2.0.87",
                    distTags: { latest: "2.0.87" },
                    versions: ["2.0.87", "4.0.12"],
                    time: {},
                    repoUrl: null,
                    repoDirectory: null,
                    readme: null,
                    license: null
                })
            });

            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.upgradeType).toBe("none");
            expect(deps[0]!.latestVersion).toBe("4.0.12");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("skips prerelease versions when resolving latest", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { prerelpkg: "^1.2.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "prerelpkg", childVersion: "1.2.14" })];

            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async () => ({
                    name: "prerelpkg",
                    latestVersion: "1.2.15-rc.123",
                    distTags: { latest: "1.2.15-rc.123" },
                    versions: ["1.2.14", "1.2.15-rc.123"],
                    time: {},
                    repoUrl: null,
                    repoDirectory: null,
                    readme: null,
                    license: null
                })
            });

            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.latestVersion).toBe("1.2.14");
            expect(deps[0]!.upgradeType).toBe("none");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("finds the latest stable version when dist-tags points to a prerelease", async () => {
        const testDir = createTestDir();
        try {
            writeFileSync(
                join(testDir, "package.json"),
                JSON.stringify({
                    name: "test",
                    dependencies: { mixedpkg: "^1.0.0" }
                })
            );

            const lockfileEdges = [makeEdge({ childPackage: "mixedpkg", childVersion: "1.0.0" })];

            const service = createService({
                lockfileEdges,
                getPackageInfoHandler: async () => ({
                    name: "mixedpkg",
                    latestVersion: "2.0.0-alpha.1",
                    distTags: { latest: "2.0.0-alpha.1" },
                    versions: ["1.0.0", "1.1.0", "1.2.0", "2.0.0-alpha.1"],
                    time: {},
                    repoUrl: null,
                    repoDirectory: null,
                    readme: null,
                    license: null
                })
            });

            const { dependencies: deps } = await service.scan(testDir, "yarn");

            expect(deps).toHaveLength(1);
            expect(deps[0]!.latestVersion).toBe("1.2.0");
            expect(deps[0]!.upgradeType).toBe("minor");
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    });
});
