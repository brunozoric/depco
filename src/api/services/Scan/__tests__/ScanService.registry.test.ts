import { describe, it, expect } from "vitest";
import { writeFileSync, rmSync } from "fs";
import { join } from "path";
import {
    REGISTRY_DATA,
    makeEdge,
    createTestDir,
    createService
} from "./ScanService.testHelpers.js";

describe("ScanService - registry resolution and upgrade classification", () => {
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
