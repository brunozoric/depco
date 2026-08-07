import { createHash } from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { loginCodes, sessions } from "#api/db/schema.js";
import { UserService } from "../abstractions/UserService.js";
import { UserService as UserServiceRegistration } from "../UserService.js";
import { EmailService } from "../Email/index.js";
import { AuthService } from "../abstractions/AuthService.js";
import { AuthService as AuthServiceRegistration } from "../AuthService.js";

function hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

describe("AuthService", () => {
    let databaseClient: DatabaseClient.Interface;
    let userService: UserService.Interface;
    let authService: AuthService.Interface;
    let emailService: EmailService.Interface;
    let userId: string;

    beforeEach(async () => {
        databaseClient = createTestDatabaseClient();
        emailService = { send: vi.fn() };

        const container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);
        container.registerInstance(EmailService, emailService);
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        userService = container.resolve(UserService);
        authService = container.resolve(AuthService);

        const user = await userService.create({
            email: "test@example.com",
            displayName: "Test User",
            password: "password123",
            permission: "full"
        });
        userId = user.id;
    });

    describe("login", () => {
        it("should create a login code in the DB and send an email", async () => {
            await authService.login({ email: "test@example.com", password: "password123" });

            const codeRows = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .all();

            expect(codeRows).toHaveLength(1);
            expect(codeRows[0]!.type).toBe("email-code");
            expect(emailService.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "test@example.com" })
            );
        });

        it("should throw for wrong password", async () => {
            await expect(
                authService.login({ email: "test@example.com", password: "wrongpassword" })
            ).rejects.toThrow();
        });

        it("should throw for unknown email", async () => {
            await expect(
                authService.login({ email: "nobody@example.com", password: "password123" })
            ).rejects.toThrow();
        });

        it("should throw for inactive user", async () => {
            await userService.deactivate(userId);

            await expect(
                authService.login({ email: "test@example.com", password: "password123" })
            ).rejects.toThrow();
        });
    });

    describe("verifyCode", () => {
        it("should create a session and return token + user for a valid code", async () => {
            await authService.login({ email: "test@example.com", password: "password123" });

            const codeRow = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .get();

            const result = await authService.verifyCode({
                email: "test@example.com",
                code: codeRow!.code
            });

            expect(result.token).toBeDefined();
            expect(result.user.email).toBe("test@example.com");

            const sessionRows = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, userId))
                .all();
            expect(sessionRows).toHaveLength(1);
        });

        it("should reject an expired code", async () => {
            await databaseClient.db
                .insert(loginCodes)
                .values({
                    id: "expired-code",
                    userId,
                    code: "123456",
                    type: "email-code",
                    expiresAt: Date.now() - 1000,
                    createdAt: Date.now() - 2000
                })
                .run();

            await expect(
                authService.verifyCode({ email: "test@example.com", code: "123456" })
            ).rejects.toThrow();
        });

        it("should reject an already-used code", async () => {
            await databaseClient.db
                .insert(loginCodes)
                .values({
                    id: "used-code",
                    userId,
                    code: "654321",
                    type: "email-code",
                    expiresAt: Date.now() + 60000,
                    usedAt: Date.now(),
                    createdAt: Date.now()
                })
                .run();

            await expect(
                authService.verifyCode({ email: "test@example.com", code: "654321" })
            ).rejects.toThrow();
        });

        it("should reject an unknown code", async () => {
            await expect(
                authService.verifyCode({ email: "test@example.com", code: "000000" })
            ).rejects.toThrow();
        });

        it("should reject a valid code if the user was deactivated after it was issued", async () => {
            await authService.login({ email: "test@example.com", password: "password123" });
            const codeRow = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .get();

            await userService.deactivate(userId);

            await expect(
                authService.verifyCode({ email: "test@example.com", code: codeRow!.code })
            ).rejects.toThrow();

            const sessionRows = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, userId))
                .all();
            expect(sessionRows).toHaveLength(0);
        });
    });

    describe("requestMagicLink", () => {
        it("should create a login code and send an email", async () => {
            await authService.requestMagicLink({
                email: "test@example.com",
                baseUrl: "http://localhost:3000/login"
            });

            const codeRows = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .all();

            expect(codeRows).toHaveLength(1);
            expect(codeRows[0]!.type).toBe("magic-link");
            expect(emailService.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "test@example.com" })
            );
        });

        it("should throw for unknown email", async () => {
            await expect(
                authService.requestMagicLink({
                    email: "nobody@example.com",
                    baseUrl: "http://localhost:3000/login"
                })
            ).rejects.toThrow();
        });
    });

    describe("verifyMagicLink", () => {
        it("should create a session and return token + user for a valid link", async () => {
            await authService.requestMagicLink({
                email: "test@example.com",
                baseUrl: "http://localhost:3000/login"
            });

            const sendMock = emailService.send as unknown as { mock: { calls: unknown[][] } };
            const sentParams = sendMock.mock.calls[0]![0] as { text: string };
            const link = sentParams.text.match(/http\S+/)![0];
            const token = new URL(link).searchParams.get("token")!;

            const result = await authService.verifyMagicLink({
                token,
                email: "test@example.com"
            });

            expect(result.token).toBeDefined();
            expect(result.user.email).toBe("test@example.com");
        });

        it("should reject an invalid token", async () => {
            await expect(
                authService.verifyMagicLink({ token: "bogus", email: "test@example.com" })
            ).rejects.toThrow();
        });

        it("should reject a valid link if the user was deactivated after it was issued", async () => {
            await authService.requestMagicLink({
                email: "test@example.com",
                baseUrl: "http://localhost:3000/login"
            });

            const sendMock = emailService.send as unknown as { mock: { calls: unknown[][] } };
            const sentParams = sendMock.mock.calls[0]![0] as { text: string };
            const link = sentParams.text.match(/http\S+/)![0];
            const token = new URL(link).searchParams.get("token")!;

            await userService.deactivate(userId);

            await expect(
                authService.verifyMagicLink({ token, email: "test@example.com" })
            ).rejects.toThrow();

            const sessionRows = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, userId))
                .all();
            expect(sessionRows).toHaveLength(0);
        });
    });

    describe("getSessionUser", () => {
        it("should return the user for a valid token hash", async () => {
            await authService.login({ email: "test@example.com", password: "password123" });
            const codeRow = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .get();
            const { token } = await authService.verifyCode({
                email: "test@example.com",
                code: codeRow!.code
            });

            const sessionUser = await authService.getSessionUser(hashToken(token));

            expect(sessionUser).not.toBeNull();
            expect(sessionUser!.email).toBe("test@example.com");
        });

        it("should return null for an unknown token hash", async () => {
            const sessionUser = await authService.getSessionUser(hashToken("nonexistent"));
            expect(sessionUser).toBeNull();
        });

        it("should return null and delete the row for an expired session", async () => {
            const tokenHash = hashToken("expired-token");
            await databaseClient.db
                .insert(sessions)
                .values({
                    id: "expired-session",
                    userId,
                    tokenHash,
                    expiresAt: Date.now() - 1000,
                    createdAt: Date.now() - 2000
                })
                .run();

            const sessionUser = await authService.getSessionUser(tokenHash);
            expect(sessionUser).toBeNull();

            const remaining = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.id, "expired-session"))
                .all();
            expect(remaining).toHaveLength(0);
        });
    });

    describe("logout", () => {
        it("should delete the session", async () => {
            await authService.login({ email: "test@example.com", password: "password123" });
            const codeRow = await databaseClient.db
                .select()
                .from(loginCodes)
                .where(eq(loginCodes.userId, userId))
                .get();
            const { token } = await authService.verifyCode({
                email: "test@example.com",
                code: codeRow!.code
            });

            await authService.logout(hashToken(token));

            const remaining = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, userId))
                .all();
            expect(remaining).toHaveLength(0);
        });
    });

    describe("forceLogout", () => {
        it("should delete all sessions for a user", async () => {
            await databaseClient.db
                .insert(sessions)
                .values([
                    {
                        id: "session-1",
                        userId,
                        tokenHash: hashToken("token-1"),
                        expiresAt: Date.now() + 60000,
                        createdAt: Date.now()
                    },
                    {
                        id: "session-2",
                        userId,
                        tokenHash: hashToken("token-2"),
                        expiresAt: Date.now() + 60000,
                        createdAt: Date.now()
                    }
                ])
                .run();

            await authService.forceLogout(userId);

            const remaining = await databaseClient.db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, userId))
                .all();
            expect(remaining).toHaveLength(0);
        });
    });

    describe("cleanupExpired", () => {
        it("should delete expired sessions and login codes", async () => {
            await databaseClient.db
                .insert(sessions)
                .values({
                    id: "expired-session",
                    userId,
                    tokenHash: hashToken("expired-session-token"),
                    expiresAt: Date.now() - 1000,
                    createdAt: Date.now() - 2000
                })
                .run();
            await databaseClient.db
                .insert(loginCodes)
                .values({
                    id: "expired-code",
                    userId,
                    code: "999999",
                    type: "email-code",
                    expiresAt: Date.now() - 1000,
                    createdAt: Date.now() - 2000
                })
                .run();

            await authService.cleanupExpired();

            const remainingSessions = await databaseClient.db.select().from(sessions).all();
            const remainingCodes = await databaseClient.db.select().from(loginCodes).all();
            expect(remainingSessions).toHaveLength(0);
            expect(remainingCodes).toHaveLength(0);
        });
    });
});
