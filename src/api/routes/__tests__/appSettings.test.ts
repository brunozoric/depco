import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfigService.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { appSettingsRoutes } from "../appSettings.js";
import { appSettings } from "#api/db/schema.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("app settings routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        registerEncryption(container);
        container.register(FileConfigService).inSingletonScope();
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();
        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(appSettingsRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/settings/app returns empty list when no settings exist", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/settings/app"
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
    });

    it("PUT /api/settings/app/:key creates a new setting", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: "/api/settings/app/upgrade.branchTemplate",
            payload: { value: "my-branch-${YYYY}" }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.key).toBe("upgrade.branchTemplate");
        expect(body.item.value).toBe("my-branch-${YYYY}");
    });

    it("PUT /api/settings/app/:key updates an existing setting", async () => {
        await db
            .insert(appSettings)
            .values({ key: "upgrade.branchTemplate", value: "old-value" })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: "/api/settings/app/upgrade.branchTemplate",
            payload: { value: "new-value" }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.value).toBe("new-value");
    });

    it("GET /api/settings/app returns all settings", async () => {
        await db
            .insert(appSettings)
            .values([
                { key: "a", value: "1" },
                { key: "b", value: "2" }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/settings/app"
        });
        const body = response.json();
        expect(body.items).toHaveLength(2);
        expect(body.total).toBe(2);
    });

    it("returns configSource db and empty fileManaged when no global config file", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/settings/app"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.configSource).toBe("db");
        expect(body.fileManaged).toEqual([]);
        expect(body.items).toBeDefined();
    });

    it("returns configSource file and fileManaged keys when global config has settings", async () => {
        const configPath = join(process.cwd(), ".dependency-upgrader.json");
        await writeFile(
            configPath,
            JSON.stringify({
                settings: { branchTemplate: "custom/${YYYY}" }
            }),
            "utf-8"
        );

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/app"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("file");
            expect(body.fileManaged).toEqual(["branch_template"]);
            const branchItem = body.items.find(
                (item: { key: string }) => item.key === "branch_template"
            );
            expect(branchItem.value).toBe("custom/${YYYY}");
        } finally {
            await rm(configPath, { force: true });
        }
    });

    it("returns configSource error and configError when file has invalid JSON", async () => {
        const configPath = join(process.cwd(), ".dependency-upgrader.json");
        await writeFile(configPath, "bad json{{{", "utf-8");

        try {
            await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/app"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("error");
            expect(body.configError).toBeDefined();
            expect(body.configError.type).toBe("json");
            expect(body.fileManaged).toEqual([]);
            expect(body.items).toHaveLength(1);
        } finally {
            await rm(configPath, { force: true });
        }
    });

    it("returns configSource error on invalid schema", async () => {
        const configPath = join(process.cwd(), ".dependency-upgrader.json");
        await writeFile(configPath, JSON.stringify({ settings: { logLevel: "debug" } }), "utf-8");

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/settings/app"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.configSource).toBe("error");
            expect(body.configError).toBeDefined();
            expect(body.configError.type).toBe("schema");
        } finally {
            await rm(configPath, { force: true });
        }
    });
});
