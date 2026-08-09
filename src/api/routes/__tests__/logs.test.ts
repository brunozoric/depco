import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";
import { EmailService } from "../../services/Email/index.js";
import { UserService as UserServiceRegistration } from "../../services/Auth/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/Auth/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { logsRoutes } from "../logs.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

interface ILogOverrides {
    level?: string;
    source?: string;
    projectId?: string | null;
    message?: string;
    createdAt?: number;
}

async function insertLog(db: TestDb, overrides: ILogOverrides = {}): Promise<string> {
    const id = generateId();
    await db
        .insert(appLogs)
        .values({
            id,
            level: "error",
            source: "scan",
            projectId: null,
            message: "test error",
            details: null,
            createdAt: Date.now(),
            ...overrides
        })
        .run();
    return id;
}

describe("logs routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(logsRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("lists all logs", async () => {
        await insertLog(db);
        await insertLog(db, { level: "warn", message: "warning msg" });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/logs"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(2);
        expect(json.total).toBe(2);
    });

    it("filters by level", async () => {
        await insertLog(db, { level: "error" });
        await insertLog(db, { level: "warn" });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/logs?level=error"
        });

        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].level).toBe("error");
    });

    it("filters by source", async () => {
        await insertLog(db, { source: "scan" });
        await insertLog(db, { source: "install" });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/logs?source=scan"
        });

        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].source).toBe("scan");
    });

    it("filters by date range", async () => {
        const old = Date.now() - 100_000;
        const recent = Date.now();
        await insertLog(db, { createdAt: old });
        await insertLog(db, { createdAt: recent });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/logs?from=${recent - 1}`
        });

        const json = response.json();
        expect(json.items).toHaveLength(1);
    });

    it("paginates with limit and offset", async () => {
        for (let i = 0; i < 5; i++) {
            await insertLog(db, { createdAt: Date.now() + i });
        }

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/logs?limit=2&offset=2"
        });

        const json = response.json();
        expect(json.items).toHaveLength(2);
        expect(json.total).toBe(5);
    });

    it("returns logs ordered by createdAt DESC", async () => {
        await insertLog(db, { message: "first", createdAt: 1000 });
        await insertLog(db, { message: "second", createdAt: 2000 });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/logs"
        });

        const json = response.json();
        expect(json.items[0].message).toBe("second");
        expect(json.items[1].message).toBe("first");
    });

    it("deletes all logs when no filters", async () => {
        await insertLog(db);
        await insertLog(db);

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: "/api/logs",
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.deleted).toBe(2);

        const remaining = await db.select().from(appLogs).all();
        expect(remaining).toHaveLength(0);
    });

    it("deletes only filtered logs", async () => {
        await insertLog(db, { level: "error" });
        await insertLog(db, { level: "warn" });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: "/api/logs",
            payload: { level: "error" }
        });

        const json = response.json();
        expect(json.deleted).toBe(1);

        const remaining = await db.select().from(appLogs).all();
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.level).toBe("warn");
    });
});
