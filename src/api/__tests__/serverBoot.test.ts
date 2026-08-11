import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { FastifyInstance } from "fastify";

const tempDir = mkdtempSync(join(tmpdir(), "depco-server-boot-"));
let app: FastifyInstance;

afterAll(async () => {
    if (app) {
        await app.close();
    }
    rmSync(tempDir, { recursive: true, force: true });
});

async function getServer(): Promise<FastifyInstance> {
    if (!app) {
        process.env["DB_PATH"] = join(tempDir, "test.db");
        const { createServer } = await import("../server.js");
        app = await createServer();
        await app.ready();
    }
    return app;
}

describe("Server Boot", () => {
    it("createServer() boots and wires all DI dependencies", async () => {
        const server = await getServer();
        const routeTree = server.printRoutes();

        expect(routeTree).toContain("api/");
        expect(routeTree).toContain("GET");
        expect(routeTree).toContain("POST");
        expect(routeTree).toContain("DELETE");
        expect(routeTree).toContain("ws");
    });

    it("GET /api/health returns ok without authentication", async () => {
        const server = await getServer();

        const response = await server.inject({
            method: "GET",
            url: "/api/health"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok" });
    });

    it("all route groups resolve (not 404)", async () => {
        const server = await getServer();

        const endpoints = [
            "/api/projects",
            "/api/dashboard/health",
            "/api/dashboard/activity",
            "/api/dashboard/security",
            "/api/dashboard/staleness",
            "/api/vulnerabilities",
            "/api/vulnerabilities/summary",
            "/api/licenses",
            "/api/licenses/summary",
            "/api/license-policies",
            "/api/license-violations",
            "/api/packages",
            "/api/teams",
            "/api/users",
            "/api/jobs",
            "/api/logs",
            "/api/settings/security",
            "/api/settings/app",
            "/api/scan-schedules",
            "/api/projects/backup",
            "/api/auto-fix/pull-requests",
            "/api/sbom"
        ];

        for (const url of endpoints) {
            const response = await server.inject({
                method: "GET",
                url,
                headers: { authorization: "Bearer test-token" }
            });
            expect(response.statusCode, `${url} returned 404`).not.toBe(404);
        }
    });
});
