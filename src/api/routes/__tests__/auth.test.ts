import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { loginCodes, sessions } from "#api/db/schema.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { authRoutes } from "../auth.js";

type TestDb = DatabaseClient.Interface["db"];
type TestContainer = ReturnType<typeof createContainer>;

describe("auth routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let container: TestContainer;

    beforeEach(async () => {
        const databaseClient = createTestDatabaseClient();
        db = databaseClient.db;

        container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(authRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    it("POST /api/auth/login with valid credentials returns success", async () => {
        const userService = container.resolve(UserService);
        await userService.create({
            email: "test@example.com",
            displayName: "Test User",
            password: "password123",
            permission: "full"
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email: "test@example.com", password: "password123" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ success: true });
    });

    it("POST /api/auth/login with wrong password returns 401", async () => {
        const userService = container.resolve(UserService);
        await userService.create({
            email: "test@example.com",
            displayName: "Test User",
            password: "password123",
            permission: "full"
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email: "test@example.com", password: "wrongpassword" }
        });

        expect(response.statusCode).toBe(401);
    });

    it("POST /api/auth/verify-code with valid code returns token + user", async () => {
        const userService = container.resolve(UserService);
        const created = await userService.create({
            email: "test@example.com",
            displayName: "Test User",
            password: "password123",
            permission: "full"
        });

        await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email: "test@example.com", password: "password123" }
        });

        const codeRow = await db
            .select()
            .from(loginCodes)
            .where(eq(loginCodes.userId, created.id))
            .get();

        const response = await app.inject({
            method: "POST",
            url: "/api/auth/verify-code",
            payload: { email: "test@example.com", code: codeRow!.code }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.token).toBeDefined();
        expect(body.item.user.email).toBe("test@example.com");
    });

    it("POST /api/auth/verify-code with expired code returns 400", async () => {
        const userService = container.resolve(UserService);
        const created = await userService.create({
            email: "test@example.com",
            displayName: "Test User",
            password: "password123",
            permission: "full"
        });

        await db
            .insert(loginCodes)
            .values({
                id: "expired-code",
                userId: created.id,
                code: "123456",
                type: "email-code",
                expiresAt: Date.now() - 1000,
                createdAt: Date.now() - 2000
            })
            .run();

        const response = await app.inject({
            method: "POST",
            url: "/api/auth/verify-code",
            payload: { email: "test@example.com", code: "123456" }
        });

        expect(response.statusCode).toBe(400);
    });

    it("GET /api/auth/me with valid token returns user", async () => {
        const { token, userId } = await createTestSession({ db, email: "me@example.com" });

        const response = await app.inject({
            method: "GET",
            url: "/api/auth/me",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.id).toBe(userId);
        expect(body.item.email).toBe("me@example.com");
    });

    it("GET /api/auth/me without token returns 401", async () => {
        const response = await app.inject({ method: "GET", url: "/api/auth/me" });

        expect(response.statusCode).toBe(401);
    });

    it("POST /api/auth/logout deletes session", async () => {
        const { token, userId } = await createTestSession({ db });

        const response = await app.inject({
            method: "POST",
            url: "/api/auth/logout",
            headers: { authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);

        const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId)).all();
        expect(remaining).toHaveLength(0);
    });
});
