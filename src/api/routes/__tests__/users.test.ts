import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users, sessions } from "#api/db/schema.js";
import { EmailService } from "#api/services/abstractions/EmailService.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { userRoutes } from "../users.js";

type TestDb = DatabaseClient.Interface["db"];
type TestContainer = ReturnType<typeof createContainer>;

describe("user routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let container: TestContainer;
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(async () => {
        const databaseClient = createTestDatabaseClient();
        db = databaseClient.db;

        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);
        container.registerInstance(EmailService, { send: vi.fn() });
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(userRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/users returns list", async () => {
        const { token } = await createTestSession({ db });

        const response = await app.inject({
            method: "GET",
            url: "/api/users",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.total).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(body.items)).toBe(true);
    });

    it("GET /api/users/:id returns 404 for unknown id", async () => {
        const { token } = await createTestSession({ db });

        const response = await app.inject({
            method: "GET",
            url: "/api/users/nonexistent",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(404);
    });

    it("POST /api/users with full permission creates user", async () => {
        const { token } = await createTestSession({ db, permission: "full" });

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: { authorization: `Bearer ${token}` },
            payload: {
                email: "new@example.com",
                displayName: "New User",
                password: "password123",
                permission: "read-only"
            }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().item.email).toBe("new@example.com");
    });

    it("POST /api/users with read-only permission returns 403", async () => {
        const { token } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: { authorization: `Bearer ${token}` },
            payload: {
                email: "new@example.com",
                displayName: "New User",
                password: "password123",
                permission: "read-only"
            }
        });

        expect(response.statusCode).toBe(403);
    });

    it("PUT /api/users/:id own profile update works for read-only", async () => {
        const { token, userId } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "PUT",
            url: `/api/users/${userId}`,
            headers: { authorization: `Bearer ${token}` },
            payload: { displayName: "Updated Name" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().item.displayName).toBe("Updated Name");
    });

    it("PUT /api/users/:id ignores permission field on self-update", async () => {
        const { token, userId } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "PUT",
            url: `/api/users/${userId}`,
            headers: { authorization: `Bearer ${token}` },
            payload: { displayName: "Still Me", permission: "full" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.displayName).toBe("Still Me");
        expect(body.item.permission).toBe("read-only");
    });

    it("PUT /api/users/:id permission change requires full", async () => {
        const { token: readOnlyToken } = await createTestSession({ db, permission: "read-only" });
        const { userId: otherUserId } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "PUT",
            url: `/api/users/${otherUserId}`,
            headers: { authorization: `Bearer ${readOnlyToken}` },
            payload: { permission: "full" }
        });

        expect(response.statusCode).toBe(403);
    });

    it("PUT /api/users/:id allows full user to update another user's permission", async () => {
        const { token: fullToken } = await createTestSession({ db, permission: "full" });
        const { userId: otherUserId } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "PUT",
            url: `/api/users/${otherUserId}`,
            headers: { authorization: `Bearer ${fullToken}` },
            payload: { permission: "full" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().item.permission).toBe("full");
    });

    it("DELETE /api/users/:id deletes sessions and closes ws connections", async () => {
        const { token: fullToken } = await createTestSession({ db, permission: "full" });
        const { userId: targetId } = await createTestSession({ db, permission: "read-only" });

        const response = await app.inject({
            method: "DELETE",
            url: `/api/users/${targetId}`,
            headers: { authorization: `Bearer ${fullToken}` }
        });

        expect(response.statusCode).toBe(200);

        const remainingSessions = await db
            .select()
            .from(sessions)
            .where(eq(sessions.userId, targetId))
            .all();
        expect(remainingSessions).toHaveLength(0);

        const userRow = await db.select().from(users).where(eq(users.id, targetId)).get();
        expect(userRow?.isActive).toBe(0);

        expect(broadcaster.closeConnectionsForUser).toHaveBeenCalledWith(targetId);
    });

    it("DELETE /api/users/:id cannot delete self", async () => {
        const { token, userId } = await createTestSession({ db, permission: "full" });

        const response = await app.inject({
            method: "DELETE",
            url: `/api/users/${userId}`,
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(400);
    });

    it("POST /api/users/:id/force-logout on self returns 400", async () => {
        const { token, userId } = await createTestSession({ db, permission: "full" });

        const response = await app.inject({
            method: "POST",
            url: `/api/users/${userId}/force-logout`,
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(400);
    });

    it("POST /api/users/:id/force-logout on other user deletes sessions", async () => {
        const { token: fullToken } = await createTestSession({ db, permission: "full" });
        const { userId: targetId } = await createTestSession({ db });

        const response = await app.inject({
            method: "POST",
            url: `/api/users/${targetId}/force-logout`,
            headers: { authorization: `Bearer ${fullToken}` }
        });

        expect(response.statusCode).toBe(200);

        const remainingSessions = await db
            .select()
            .from(sessions)
            .where(eq(sessions.userId, targetId))
            .all();
        expect(remainingSessions).toHaveLength(0);
        expect(broadcaster.closeConnectionsForUser).toHaveBeenCalledWith(targetId);
    });
});
