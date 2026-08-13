import { randomBytes } from "crypto";
import { eq, lt } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { AuthService as Abstraction } from "./abstractions/AuthService.js";
import { UserService } from "./abstractions/UserService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users, sessions } from "#api/db/schema.js";
import { hashToken } from "./tokenHash.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Session lifecycle: issuing, looking up, and revoking `sessions` rows.
 * Internal helper for AuthServiceImpl — not DI-registered.
 */
export class SessionManager {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly userService: UserService.Interface
    ) {}

    public async createSession(userId: string): Promise<Abstraction.VerifyResult> {
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const now = Date.now();

        await this.databaseClient.db
            .insert(sessions)
            .values({
                id: generateId(),
                userId,
                tokenHash,
                expiresAt: now + SESSION_DURATION_MS,
                createdAt: now
            })
            .run();

        const user = await this.userService.getById(userId);

        return { token: rawToken, user: user! };
    }

    public async getSessionUser(tokenHash: string): Promise<Abstraction.SessionUser | null> {
        const now = Date.now();
        const row = await this.databaseClient.db
            .select({
                sessionId: sessions.id,
                expiresAt: sessions.expiresAt,
                userId: users.id,
                email: users.email,
                displayName: users.displayName,
                permission: users.permission,
                isActive: users.isActive
            })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .where(eq(sessions.tokenHash, tokenHash))
            .get();

        if (!row) {
            return null;
        }

        if (row.expiresAt < now) {
            await this.databaseClient.db
                .delete(sessions)
                .where(eq(sessions.id, row.sessionId))
                .run();
            return null;
        }

        if (row.isActive !== 1) {
            return null;
        }

        return {
            id: row.userId,
            email: row.email,
            displayName: row.displayName,
            permission: row.permission
        };
    }

    public async logout(tokenHash: string): Promise<void> {
        await this.databaseClient.db
            .delete(sessions)
            .where(eq(sessions.tokenHash, tokenHash))
            .run();
    }

    public async forceLogout(userId: string): Promise<void> {
        await this.databaseClient.db.delete(sessions).where(eq(sessions.userId, userId)).run();
    }

    public async cleanupExpiredSessions(): Promise<void> {
        const now = Date.now();
        await this.databaseClient.db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
    }
}
