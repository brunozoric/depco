import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import {
    makeEdge,
    makeWorkspaceLine,
    createTestDir,
    createService
} from "./ScanService.testHelpers.js";

describe("ScanService - workspace discovery and collection", () => {
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
});
