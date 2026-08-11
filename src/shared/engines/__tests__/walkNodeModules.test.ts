import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walkNodeModules } from "../walkNodeModules.js";

describe("walkNodeModules", () => {
    let tempDirectory: string;

    beforeEach(() => {
        tempDirectory = mkdtempSync(join(tmpdir(), "walk-node-modules-"));
    });

    afterEach(() => {
        rmSync(tempDirectory, { recursive: true, force: true });
    });

    it("returns an empty map when node_modules does not exist", () => {
        const result = walkNodeModules({
            nodeModulesPath: join(tempDirectory, "node_modules")
        });
        expect(result.size).toBe(0);
    });

    it("collects packages with engines.node field", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
        writeFileSync(
            join(nodeModules, "pkg-a", "package.json"),
            JSON.stringify({ name: "pkg-a", engines: { node: ">=18" } })
        );

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.size).toBe(1);
        expect(result.get("pkg-a")).toEqual({
            packageName: "pkg-a",
            enginesNode: ">=18"
        });
    });

    it("collects packages without engines.node as null", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "no-engines"), { recursive: true });
        writeFileSync(
            join(nodeModules, "no-engines", "package.json"),
            JSON.stringify({ name: "no-engines" })
        );

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.get("no-engines")).toEqual({
            packageName: "no-engines",
            enginesNode: null
        });
    });

    it("handles scoped packages", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "@scope", "pkg-b"), { recursive: true });
        writeFileSync(
            join(nodeModules, "@scope", "pkg-b", "package.json"),
            JSON.stringify({ name: "@scope/pkg-b", engines: { node: ">=20" } })
        );

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.get("@scope/pkg-b")).toEqual({
            packageName: "@scope/pkg-b",
            enginesNode: ">=20"
        });
    });

    it("skips .bin directory", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, ".bin"), { recursive: true });
        mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
        writeFileSync(
            join(nodeModules, "pkg-a", "package.json"),
            JSON.stringify({ name: "pkg-a" })
        );

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.size).toBe(1);
        expect(result.has("pkg-a")).toBe(true);
    });

    it("calls onMalformedPackage for unreadable package.json and still adds entry with null enginesNode", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "bad-pkg"), { recursive: true });
        writeFileSync(join(nodeModules, "bad-pkg", "package.json"), "{ not valid json");

        const onMalformedPackage = vi.fn();
        const result = walkNodeModules({ nodeModulesPath: nodeModules, onMalformedPackage });

        expect(onMalformedPackage).toHaveBeenCalledWith(
            expect.objectContaining({ packageName: "bad-pkg" })
        );
        expect(result.get("bad-pkg")).toEqual({
            packageName: "bad-pkg",
            enginesNode: null
        });
    });

    it("walks nested node_modules recursively", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "pkg-a", "node_modules", "nested-pkg"), { recursive: true });
        writeFileSync(
            join(nodeModules, "pkg-a", "package.json"),
            JSON.stringify({ name: "pkg-a", engines: { node: ">=18" } })
        );
        writeFileSync(
            join(nodeModules, "pkg-a", "node_modules", "nested-pkg", "package.json"),
            JSON.stringify({ name: "nested-pkg", engines: { node: ">=16" } })
        );

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.size).toBe(2);
        expect(result.has("pkg-a")).toBe(true);
        expect(result.has("nested-pkg")).toBe(true);
    });

    it("deduplicates by realpath to prevent symlink cycles", () => {
        const nodeModules = join(tempDirectory, "node_modules");
        mkdirSync(join(nodeModules, "pkg-a"), { recursive: true });
        writeFileSync(
            join(nodeModules, "pkg-a", "package.json"),
            JSON.stringify({ name: "pkg-a" })
        );

        try {
            symlinkSync(nodeModules, join(nodeModules, "pkg-a", "node_modules"));
        } catch {
            return;
        }

        const result = walkNodeModules({ nodeModulesPath: nodeModules });

        expect(result.size).toBe(1);
    });
});
