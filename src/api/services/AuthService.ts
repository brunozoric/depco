import { createHash, randomBytes } from "crypto";
import { eq, and, lt, isNull } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AuthService as Abstraction } from "./abstractions/AuthService.js";
import { UserService } from "./abstractions/UserService.js";
import { EmailService } from "./abstractions/EmailService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users, sessions, loginCodes } from "#api/db/schema.js";
import { HttpError } from "#api/errors/HttpError.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

function generateCode(): string {
    return Math.random().toString().slice(2, 8).padStart(6, "0");
}

class AuthServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly userService: UserService.Interface,
        private readonly emailService: EmailService.Interface
    ) {}

    public async login(params: Abstraction.LoginParams): Promise<void> {
        const email = params.email.toLowerCase().trim();
        const userRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();

        if (!userRow) {
            throw new HttpError(401, "Invalid email or password");
        }

        if (userRow.isActive !== 1) {
            throw new HttpError(403, "Account is deactivated");
        }

        const valid = await this.userService.verifyPassword({
            userId: userRow.id,
            password: params.password
        });

        if (!valid) {
            throw new HttpError(401, "Invalid email or password");
        }

        const code = generateCode();
        const now = Date.now();

        await this.databaseClient.db
            .insert(loginCodes)
            .values({
                id: generateId(),
                userId: userRow.id,
                code,
                type: "email-code",
                expiresAt: now + CODE_TTL_MS,
                createdAt: now
            })
            .run();

        await this.emailService.send({
            to: email,
            subject: "Your login code",
            text: `Your verification code is: ${code}`
        });
    }

    public async verifyCode(
        params: Abstraction.VerifyCodeParams
    ): Promise<Abstraction.VerifyResult> {
        const email = params.email.toLowerCase().trim();
        const userRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();

        if (!userRow) {
            throw new HttpError(400, "Invalid or expired code");
        }

        const now = Date.now();
        const codeRow = await this.databaseClient.db
            .select()
            .from(loginCodes)
            .where(
                and(
                    eq(loginCodes.userId, userRow.id),
                    eq(loginCodes.code, params.code),
                    eq(loginCodes.type, "email-code"),
                    isNull(loginCodes.usedAt)
                )
            )
            .get();

        if (!codeRow) {
            throw new HttpError(400, "Invalid or expired code");
        }

        if (codeRow.expiresAt < now) {
            throw new HttpError(400, "Code has expired");
        }

        await this.databaseClient.db
            .update(loginCodes)
            .set({ usedAt: now })
            .where(eq(loginCodes.id, codeRow.id))
            .run();

        return this.createSession(userRow.id);
    }

    public async requestMagicLink(params: Abstraction.RequestMagicLinkParams): Promise<void> {
        const email = params.email.toLowerCase().trim();
        const userRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();

        if (!userRow) {
            throw new HttpError(400, "Invalid email");
        }

        if (userRow.isActive !== 1) {
            throw new HttpError(403, "Account is deactivated");
        }

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const now = Date.now();

        await this.databaseClient.db
            .insert(loginCodes)
            .values({
                id: generateId(),
                userId: userRow.id,
                code: tokenHash,
                type: "magic-link",
                expiresAt: now + CODE_TTL_MS,
                createdAt: now
            })
            .run();

        const link = `${params.baseUrl}?token=${rawToken}&email=${encodeURIComponent(email)}`;

        await this.emailService.send({
            to: email,
            subject: "Your login link",
            text: `Click the link below to log in:\n\n${link}`,
            html: `<p><a href="${link}">Click here to log in</a></p>`
        });
    }

    public async verifyMagicLink(
        params: Abstraction.VerifyMagicLinkParams
    ): Promise<Abstraction.VerifyResult> {
        const email = params.email.toLowerCase().trim();
        const userRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();

        if (!userRow) {
            throw new HttpError(400, "Invalid or expired link");
        }

        const now = Date.now();
        const tokenHash = hashToken(params.token);
        const codeRow = await this.databaseClient.db
            .select()
            .from(loginCodes)
            .where(
                and(
                    eq(loginCodes.userId, userRow.id),
                    eq(loginCodes.code, tokenHash),
                    eq(loginCodes.type, "magic-link"),
                    isNull(loginCodes.usedAt)
                )
            )
            .get();

        if (!codeRow) {
            throw new HttpError(400, "Invalid or expired link");
        }

        if (codeRow.expiresAt < now) {
            throw new HttpError(400, "Link has expired");
        }

        await this.databaseClient.db
            .update(loginCodes)
            .set({ usedAt: now })
            .where(eq(loginCodes.id, codeRow.id))
            .run();

        return this.createSession(userRow.id);
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

    public async cleanupExpired(): Promise<void> {
        const now = Date.now();
        await this.databaseClient.db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
        await this.databaseClient.db.delete(loginCodes).where(lt(loginCodes.expiresAt, now)).run();
    }

    private async createSession(userId: string): Promise<Abstraction.VerifyResult> {
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
}

export const AuthService = Abstraction.createImplementation({
    implementation: AuthServiceImpl,
    dependencies: [DatabaseClient, UserService, EmailService]
});
