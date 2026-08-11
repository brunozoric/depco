import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, symlinkSync, writeFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { filesystemRoutes } from "../filesystem.js";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";

function createProjectDir(basePath: string, name: string): string {
    const dirPath = join(basePath, name);
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(join(dirPath, "package.json"), JSON.stringify({ name }), "utf-8");
    return dirPath;
}

describe("filesystem routes", () => {
    let app: FastifyInstance;
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(testDir, { recursive: true });
        mkdirSync(join(testDir, "alpha"));
        mkdirSync(join(testDir, "beta"));
        mkdirSync(join(testDir, ".hidden"));

        app = Fastify();
        await app.register(filesystemRoutes);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        rmSync(testDir, { recursive: true, force: true });
    });

    it("returns directories sorted alphabetically, excluding hidden by default", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: Array<{ name: string }>; total: number };
        expect(body.items.map(item => item.name)).toEqual(["alpha", "beta"]);
        expect(body.total).toBe(2);
    });

    it("includes hidden directories when showHidden=true", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}&showHidden=true`
        });

        const body = response.json() as { items: Array<{ name: string }> };
        expect(body.items.map(item => item.name)).toEqual([".hidden", "alpha", "beta"]);
    });

    it("returns 400 for nonexistent path", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent("/nonexistent/path/xyz")}`
        });

        expect(response.statusCode).toBe(400);
    });

    it("returns empty items for empty directory", async () => {
        const emptyDir = join(testDir, "empty");
        mkdirSync(emptyDir);

        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent(emptyDir)}`
        });

        const body = response.json() as { items: unknown[]; total: number };
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
    });

    it("defaults to process.cwd() when no path is provided", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/filesystem/browse"
        });

        expect(response.statusCode).toBe(200);
    });

    it("resolves symlinks and returns contents of the real path", async () => {
        const outsideDir = join(tmpdir(), `fs-outside-${Date.now()}`);
        mkdirSync(outsideDir, { recursive: true });
        symlinkSync(outsideDir, join(testDir, "escape-link"));

        try {
            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/browse?path=${encodeURIComponent(join(testDir, "escape-link"))}`
            });

            // Should resolve symlink and return contents of the real path
            expect(response.statusCode).toBe(200);
        } finally {
            rmSync(outsideDir, { recursive: true, force: true });
        }
    });

    it("resolves paths with .. segments via realpath (no rejection)", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent(join(testDir, "alpha", ".."))}`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: Array<{ name: string }> };
        expect(body.items.map(item => item.name)).toEqual(["alpha", "beta"]);
    });

    it("each item has name, path, and type=directory", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/browse?path=${encodeURIComponent(testDir)}`
        });

        const body = response.json() as {
            items: Array<{ name: string; path: string; type: string }>;
        };
        for (const item of body.items) {
            expect(item.type).toBe("directory");
            expect(item.path).toContain(item.name);
        }
    });

    describe("scan with depth and workspaces", () => {
        let scanDir: string;

        beforeEach(() => {
            scanDir = join(
                tmpdir(),
                `scan-depth-${Date.now()}-${Math.random().toString(36).slice(2)}`
            );
            mkdirSync(scanDir, { recursive: true });
        });

        afterEach(() => {
            rmSync(scanDir, { recursive: true, force: true });
        });

        it("returns mode=workspaces when root package.json has workspaces", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: ["packages/*"] }),
                "utf-8"
            );
            mkdirSync(join(scanDir, "packages", "app-a"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "app-a", "package.json"), "{}", "utf-8");
            mkdirSync(join(scanDir, "packages", "app-b"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "app-b", "package.json"), "{}", "utf-8");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.mode).toBe("workspaces");
            expect(body.items).toHaveLength(2);
            expect(body.items.map((i: { name: string }) => i.name).sort()).toEqual([
                "app-a",
                "app-b"
            ]);
        });

        it("falls back to depth mode when workspace globs resolve to nothing", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: ["nonexistent/*"] }),
                "utf-8"
            );
            createProjectDir(scanDir, "project-a");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            const body = response.json();
            expect(body.mode).toBe("depth");
            expect(body.items.map((i: { name: string }) => i.name)).toContain("project-a");
        });

        it("scans to depth 1 by default", async () => {
            createProjectDir(scanDir, "top-level");
            mkdirSync(join(scanDir, "nested"), { recursive: true });
            createProjectDir(join(scanDir, "nested"), "deep-project");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            const body = response.json();
            expect(body.mode).toBe("depth");
            expect(body.items.map((i: { name: string }) => i.name)).toEqual(["top-level"]);
        });

        it("finds nested projects at specified depth", async () => {
            mkdirSync(join(scanDir, "level1", "level2"), { recursive: true });
            createProjectDir(join(scanDir, "level1", "level2"), "deep-project");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}&depth=3`
            });

            const body = response.json();
            expect(body.items.map((i: { name: string }) => i.name)).toContain("deep-project");
        });

        it("skips node_modules and hidden directories during depth scan", async () => {
            mkdirSync(join(scanDir, "node_modules", "some-pkg"), { recursive: true });
            writeFileSync(join(scanDir, "node_modules", "some-pkg", "package.json"), "{}", "utf-8");
            mkdirSync(join(scanDir, ".hidden-dir"), { recursive: true });
            writeFileSync(join(scanDir, ".hidden-dir", "package.json"), "{}", "utf-8");
            createProjectDir(scanDir, "real-project");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}&depth=2`
            });

            const body = response.json();
            const names = body.items.map((i: { name: string }) => i.name);
            expect(names).toContain("real-project");
            expect(names).not.toContain("some-pkg");
            expect(names).not.toContain(".hidden-dir");
        });

        it("resolves ** glob patterns matching nested directories", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: ["packages/**"] }),
                "utf-8"
            );
            mkdirSync(join(scanDir, "packages", "core", "sub-pkg"), { recursive: true });
            writeFileSync(
                join(scanDir, "packages", "core", "sub-pkg", "package.json"),
                "{}",
                "utf-8"
            );
            mkdirSync(join(scanDir, "packages", "utils"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "utils", "package.json"), "{}", "utf-8");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.mode).toBe("workspaces");
            const names = body.items.map((i: { name: string }) => i.name).sort();
            expect(names).toContain("sub-pkg");
            expect(names).toContain("utils");
        });

        it("excludes workspace patterns starting with !", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: ["packages/*", "!packages/excluded"] }),
                "utf-8"
            );
            mkdirSync(join(scanDir, "packages", "included"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "included", "package.json"), "{}", "utf-8");
            mkdirSync(join(scanDir, "packages", "excluded"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "excluded", "package.json"), "{}", "utf-8");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.mode).toBe("workspaces");
            const names = body.items.map((i: { name: string }) => i.name);
            expect(names).toContain("included");
            expect(names).not.toContain("excluded");
        });

        it("reads workspace patterns from workspaces.packages object form", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: { packages: ["apps/*"] } }),
                "utf-8"
            );
            mkdirSync(join(scanDir, "apps", "web"), { recursive: true });
            writeFileSync(join(scanDir, "apps", "web", "package.json"), "{}", "utf-8");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.mode).toBe("workspaces");
            expect(body.items).toHaveLength(1);
            expect(body.items[0].name).toBe("web");
        });

        it("deduplicates items matched by overlapping workspace patterns", async () => {
            writeFileSync(
                join(scanDir, "package.json"),
                JSON.stringify({ workspaces: ["packages/*", "packages/shared"] }),
                "utf-8"
            );
            mkdirSync(join(scanDir, "packages", "shared"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "shared", "package.json"), "{}", "utf-8");
            mkdirSync(join(scanDir, "packages", "core"), { recursive: true });
            writeFileSync(join(scanDir, "packages", "core", "package.json"), "{}", "utf-8");

            const response = await app.inject({
                method: "GET",
                url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.mode).toBe("workspaces");
            const names = body.items.map((i: { name: string }) => i.name).sort();
            expect(names).toEqual(["core", "shared"]);
        });
    });
});

describe("scan endpoint", () => {
    let app: FastifyInstance;
    let testDir: string;
    let db: ReturnType<typeof createTestApiContainer>["db"];

    beforeEach(async () => {
        testDir = join(tmpdir(), `fs-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(testDir, { recursive: true });

        mkdirSync(join(testDir, "project-a"));
        writeFileSync(join(testDir, "project-a", "package.json"), "{}");

        mkdirSync(join(testDir, "project-b"));
        writeFileSync(join(testDir, "project-b", "package.json"), "{}");

        mkdirSync(join(testDir, "not-a-project"));

        mkdirSync(join(testDir, "node_modules"));
        writeFileSync(join(testDir, "node_modules", "package.json"), "{}");

        mkdirSync(join(testDir, ".git"));

        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;

        app = Fastify();
        await app.register(filesystemRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        rmSync(testDir, { recursive: true, force: true });
    });

    it("returns subdirectories containing package.json", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.items.map((i: { name: string }) => i.name).sort()).toEqual([
            "project-a",
            "project-b"
        ]);
        expect(body.filteredCount).toBe(2);
        expect(body.total).toBe(2);
        // Compare against the realpath-resolved testDir: on macOS, tmpdir()
        // paths traverse a symlink (/var -> /private/var), and the handler
        // resolves symlinks the same way the browse endpoint does.
        expect(body.scannedPath).toBe(realpathSync(testDir));
    });

    it("excludes node_modules and .git directories", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
        });

        const body = response.json();
        const names = body.items.map((i: { name: string }) => i.name);
        expect(names).not.toContain("node_modules");
        expect(names).not.toContain(".git");
    });

    it("excludes already-added projects", async () => {
        const resolvedPath = join(realpathSync(testDir), "project-a");
        await db
            .insert(projects)
            .values({
                id: "existing",
                name: "project-a",
                path: resolvedPath,
                addedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
        });

        const body = response.json();
        expect(body.items.map((i: { name: string }) => i.name)).toEqual(["project-b"]);
        expect(body.filteredCount).toBe(1);
    });

    it("returns scannedCount as total subdirectories checked", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent(testDir)}`
        });

        const body = response.json();
        expect(body.scannedCount).toBe(3);
    });

    it("returns 400 for nonexistent path", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent("/nonexistent/xyz")}`
        });

        expect(response.statusCode).toBe(400);
    });

    it("returns empty items when no projects found", async () => {
        const emptyDir = join(testDir, "empty-parent");
        mkdirSync(emptyDir);
        mkdirSync(join(emptyDir, "child-no-pkg"));

        const response = await app.inject({
            method: "GET",
            url: `/api/filesystem/scan?path=${encodeURIComponent(emptyDir)}`
        });

        const body = response.json();
        expect(body.items).toEqual([]);
        expect(body.filteredCount).toBe(0);
        expect(body.scannedCount).toBe(1);
    });
});
