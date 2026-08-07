import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { FileConfigService } from "../../services/FileConfigService.js";
import { PackageJsonService } from "../../services/PackageJson/PackageJsonService.js";
import { stepHooksRoutes } from "../stepHooks.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("step hooks routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;
    const projectId = "p1";

    beforeEach(async () => {
        db = await createTestDb();
        await db
            .insert(projects)
            .values({
                id: projectId,
                name: "p1",
                path: "/tmp/p1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        container.register(FileConfigService).inSingletonScope();
        container.register(PackageJsonService).inSingletonScope();
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(stepHooksRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/projects/:id/step-hooks returns empty list for project with no hooks", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/step-hooks`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.items).toEqual([]);
        expect(body.configSource).toBe("db");
    });

    it("GET /api/projects/:id/step-hooks returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/nonexistent/step-hooks`
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.message).toBeTruthy();
    });

    it("GET /api/projects/:id/step-hooks returns file-based hooks when a config file exists", async () => {
        const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        try {
            await db
                .insert(projects)
                .values({
                    id: "p2",
                    name: "p2",
                    path: tempDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const fileConfig = {
                stepHooks: [
                    {
                        position: "pre-upgrade",
                        name: "Lint",
                        command: "yarn lint",
                        executionType: "command",
                        required: true
                    }
                ]
            };
            await writeFile(
                join(tempDir, ".dependency-upgrader.json"),
                JSON.stringify(fileConfig),
                "utf-8"
            );

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: `/api/projects/p2/step-hooks`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("file");
            expect(body.items).toHaveLength(1);
            expect(body.items[0]).toMatchObject({
                projectId: "p2",
                position: "pre-upgrade",
                name: "Lint",
                command: "yarn lint",
                type: "command",
                required: true,
                enabled: true,
                source: "file"
            });
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it("POST /api/projects/:id/step-hooks creates a hook and returns it", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/step-hooks`,
            payload: {
                position: "pre-upgrade",
                name: "Run lint",
                command: "yarn lint",
                type: "command",
                required: true
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.id).toBeTruthy();
        expect(body.item.projectId).toBe(projectId);
        expect(body.item.position).toBe("pre-upgrade");
        expect(body.item.name).toBe("Run lint");
        expect(body.item.command).toBe("yarn lint");
        expect(body.item.type).toBe("command");
        expect(body.item.required).toBe(true);
        expect(body.item.enabled).toBe(true);
        expect(body.item.source).toBe("db");
        expect(typeof body.item.sortOrder).toBe("number");
        expect(typeof body.item.createdAt).toBe("number");
        expect(typeof body.item.updatedAt).toBe("number");

        const listResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/step-hooks`
        });
        expect(listResponse.json().items).toHaveLength(1);
    });

    it("PUT /api/projects/:id/step-hooks/:hookId updates an existing hook", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/step-hooks`,
            payload: {
                position: "pre-upgrade",
                name: "Run lint",
                command: "yarn lint",
                type: "command"
            }
        });
        const hookId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: `/api/projects/${projectId}/step-hooks/${hookId}`,
            payload: {
                name: "Run lint fix",
                command: "yarn lint:fix",
                enabled: false,
                sortOrder: 5
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.id).toBe(hookId);
        expect(body.item.name).toBe("Run lint fix");
        expect(body.item.command).toBe("yarn lint:fix");
        expect(body.item.enabled).toBe(false);
        expect(body.item.sortOrder).toBe(5);
    });

    it("PUT /api/projects/:id/step-hooks/:hookId returns 404 for unknown hook", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: `/api/projects/${projectId}/step-hooks/nonexistent`,
            payload: { name: "Anything" }
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.message).toBeTruthy();
    });

    it("DELETE /api/projects/:id/step-hooks/:hookId removes a hook", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/step-hooks`,
            payload: {
                position: "pre-upgrade",
                name: "Run lint",
                command: "yarn lint",
                type: "command"
            }
        });
        const hookId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: `/api/projects/${projectId}/step-hooks/${hookId}`,
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().deleted).toBe(true);

        const listResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/step-hooks`
        });
        expect(listResponse.json().items).toEqual([]);
    });

    it("DELETE /api/projects/:id/step-hooks/:hookId returns 404 for unknown hook", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: `/api/projects/${projectId}/step-hooks/nonexistent`,
            payload: {}
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.message).toBeTruthy();
    });

    it("GET /api/projects/:id/step-hooks returns hooks ordered by position and sortOrder", async () => {
        const now = Date.now();
        await db
            .insert(projectStepHooks)
            .values([
                {
                    id: "h1",
                    projectId,
                    position: "post-upgrade",
                    name: "B",
                    command: "echo b",
                    type: "command",
                    sortOrder: 0,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: "h2",
                    projectId,
                    position: "pre-upgrade",
                    name: "A2",
                    command: "echo a2",
                    type: "command",
                    sortOrder: 1,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: "h3",
                    projectId,
                    position: "pre-upgrade",
                    name: "A1",
                    command: "echo a1",
                    type: "command",
                    sortOrder: 0,
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/step-hooks`
        });

        expect(response.statusCode).toBe(200);
        // Ordered by position (alphabetical: "post-upgrade" < "pre-upgrade"),
        // then by sortOrder within the same position.
        const ids = response.json().items.map((item: { id: string }) => item.id);
        expect(ids).toEqual(["h1", "h3", "h2"]);
    });

    it("filters discoveredScripts by existing DB hook names", async () => {
        const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        try {
            await writeFile(
                join(tempDir, "package.json"),
                JSON.stringify({
                    name: "test-project",
                    scripts: { test: "vitest", lint: "oxlint", build: "tsc" }
                }),
                "utf-8"
            );

            await db
                .insert(projects)
                .values({
                    id: "p-scripts",
                    name: "test-project",
                    path: tempDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            // Add a DB hook named "test"
            await db
                .insert(projectStepHooks)
                .values({
                    id: "h-test",
                    projectId: "p-scripts",
                    position: "pre-upgrade",
                    name: "test",
                    command: "yarn test",
                    type: "command",
                    sortOrder: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p-scripts/step-hooks"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("db");
            const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
            expect(scriptNames).toContain("lint");
            expect(scriptNames).toContain("build");
            expect(scriptNames).not.toContain("test");
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it("filters discoveredScripts by file config hook names", async () => {
        const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        try {
            await writeFile(
                join(tempDir, "package.json"),
                JSON.stringify({
                    name: "test-project",
                    scripts: { test: "vitest", lint: "oxlint", build: "tsc" }
                }),
                "utf-8"
            );

            const fileConfig = {
                stepHooks: [
                    {
                        position: "pre-upgrade",
                        name: "lint",
                        command: "yarn lint",
                        executionType: "command",
                        required: false
                    }
                ]
            };
            await writeFile(
                join(tempDir, ".dependency-upgrader.json"),
                JSON.stringify(fileConfig),
                "utf-8"
            );

            await db
                .insert(projects)
                .values({
                    id: "p-file-scripts",
                    name: "test-project",
                    path: tempDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p-file-scripts/step-hooks"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("file");
            const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
            expect(scriptNames).toContain("test");
            expect(scriptNames).toContain("build");
            expect(scriptNames).not.toContain("lint");
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it("returns empty discoveredScripts when package.json has no scripts", async () => {
        const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        try {
            await writeFile(
                join(tempDir, "package.json"),
                JSON.stringify({ name: "no-scripts" }),
                "utf-8"
            );

            await db
                .insert(projects)
                .values({
                    id: "p-no-scripts",
                    name: "no-scripts",
                    path: tempDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p-no-scripts/step-hooks"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.discoveredScripts).toEqual([]);
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it("returns all discoveredScripts when no hooks are configured", async () => {
        const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        try {
            await writeFile(
                join(tempDir, "package.json"),
                JSON.stringify({
                    name: "all-scripts",
                    scripts: { test: "vitest", lint: "oxlint" }
                }),
                "utf-8"
            );

            await db
                .insert(projects)
                .values({
                    id: "p-all-scripts",
                    name: "all-scripts",
                    path: tempDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p-all-scripts/step-hooks"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.discoveredScripts).toHaveLength(2);
            const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
            expect(scriptNames).toContain("test");
            expect(scriptNames).toContain("lint");
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
