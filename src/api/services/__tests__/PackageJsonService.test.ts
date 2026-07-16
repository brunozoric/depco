import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { PackageJsonService } from "../abstractions/PackageJsonService.js";
import { PackageJsonService as PackageJsonServiceRegistration } from "../PackageJsonService.js";

describe("PackageJsonService", () => {
    let tempDir: string;
    let service: PackageJsonService.Interface;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-pkgjson-"));
        const container = createContainer();
        container.register(PackageJsonServiceRegistration).inSingletonScope();
        service = container.resolve(PackageJsonService);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it("returns empty array when no package.json exists", async () => {
        const scripts = await service.getScripts(tempDir);
        expect(scripts).toEqual([]);
    });

    it("returns empty array when package.json has no scripts", async () => {
        await writeFile(
            join(tempDir, "package.json"),
            JSON.stringify({ name: "test-project" }),
            "utf-8"
        );

        const scripts = await service.getScripts(tempDir);
        expect(scripts).toEqual([]);
    });

    it("returns discovered scripts from package.json", async () => {
        await writeFile(
            join(tempDir, "package.json"),
            JSON.stringify({
                name: "test-project",
                scripts: {
                    build: "tsc",
                    test: "vitest run",
                    lint: "eslint ."
                }
            }),
            "utf-8"
        );

        const scripts = await service.getScripts(tempDir);
        expect(scripts).toEqual([
            { name: "build", command: "tsc" },
            { name: "lint", command: "eslint ." },
            { name: "test", command: "vitest run" }
        ]);
    });

    it("returns scripts sorted alphabetically by name", async () => {
        await writeFile(
            join(tempDir, "package.json"),
            JSON.stringify({
                scripts: { z: "echo z", a: "echo a", m: "echo m" }
            }),
            "utf-8"
        );

        const scripts = await service.getScripts(tempDir);
        expect(scripts.map(s => s.name)).toEqual(["a", "m", "z"]);
    });

    it("returns empty array on malformed package.json", async () => {
        await writeFile(join(tempDir, "package.json"), "not json{{{", "utf-8");

        const scripts = await service.getScripts(tempDir);
        expect(scripts).toEqual([]);
    });
});
