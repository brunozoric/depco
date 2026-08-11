import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { FastifyInstance } from "fastify";

describe("Server Boot", () => {
    let app: FastifyInstance | undefined;
    const tempDir = mkdtempSync(join(tmpdir(), "depco-server-boot-"));

    afterEach(async () => {
        if (app) {
            await app.close();
            app = undefined;
        }
        rmSync(tempDir, { recursive: true, force: true });
    });

    it("createServer() boots, wires DI, and resolves all route plugins", async () => {
        process.env["DB_PATH"] = join(tempDir, "test.db");

        const { createServer } = await import("../server.js");
        app = await createServer();
        await app.ready();

        const routeTree = app.printRoutes();
        expect(routeTree).toContain("api/");
        expect(routeTree).toContain("GET");
        expect(routeTree).toContain("POST");
        expect(routeTree).toContain("DELETE");
        expect(routeTree).toContain("ws");

        // Verify key endpoints resolve (not 404)
        const endpoints = [
            "/api/dashboard/health",
            "/api/projects",
            "/api/vulnerabilities",
            "/api/licenses",
            "/api/teams",
            "/api/users",
            "/api/projects/backup"
        ];

        for (const url of endpoints) {
            const response = await app.inject({
                method: "GET",
                url,
                headers: { authorization: "Bearer test-token" }
            });
            expect(response.statusCode, `${url} returned 404`).not.toBe(404);
        }
    });
});
