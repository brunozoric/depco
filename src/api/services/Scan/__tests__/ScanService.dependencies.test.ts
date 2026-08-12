import { describe, it, expect } from "vitest";
import { writeFileSync, rmSync } from "fs";
import { join } from "path";
import { makeEdge, createTestDir, createService } from "./ScanService.testHelpers.js";

describe("ScanService - dependency collection and classification", () => {
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
});
