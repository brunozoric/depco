import { eq } from "drizzle-orm";
import { AuthService as Abstraction } from "./abstractions/AuthService.js";
import { UserService } from "./abstractions/UserService.js";
import { EmailService } from "../Email/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users } from "#api/db/schema.js";
import { HttpError } from "#api/errors/HttpError.js";
import { SessionManager } from "./SessionManager.js";
import { LoginCodeManager } from "./LoginCodeManager.js";

class AuthServiceImpl implements Abstraction.Interface {
    private readonly sessionManager: SessionManager;
    private readonly loginCodeManager: LoginCodeManager;

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly userService: UserService.Interface,
        emailService: EmailService.Interface
    ) {
        this.sessionManager = new SessionManager(databaseClient, userService);
        this.loginCodeManager = new LoginCodeManager(databaseClient, emailService);
    }

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

        await this.loginCodeManager.issueEmailCode({ userId: userRow.id, email });
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

        await this.loginCodeManager.verifyEmailCode({ userId: userRow.id, code: params.code });

        const freshUserRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.id, userRow.id))
            .get();

        if (!freshUserRow || freshUserRow.isActive !== 1) {
            throw new HttpError(403, "Account is deactivated");
        }

        return this.sessionManager.createSession(userRow.id);
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

        await this.loginCodeManager.issueMagicLink({
            userId: userRow.id,
            email,
            baseUrl: params.baseUrl
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

        await this.loginCodeManager.verifyMagicLinkToken({
            userId: userRow.id,
            token: params.token
        });

        const freshUserRow = await this.databaseClient.db
            .select()
            .from(users)
            .where(eq(users.id, userRow.id))
            .get();

        if (!freshUserRow || freshUserRow.isActive !== 1) {
            throw new HttpError(403, "Account is deactivated");
        }

        return this.sessionManager.createSession(userRow.id);
    }

    public async getSessionUser(tokenHash: string): Promise<Abstraction.SessionUser | null> {
        return this.sessionManager.getSessionUser(tokenHash);
    }

    public async logout(tokenHash: string): Promise<void> {
        await this.sessionManager.logout(tokenHash);
    }

    public async forceLogout(userId: string): Promise<void> {
        await this.sessionManager.forceLogout(userId);
    }

    public async cleanupExpired(): Promise<void> {
        await this.sessionManager.cleanupExpiredSessions();
        await this.loginCodeManager.cleanupExpiredCodes();
    }
}

export const AuthService = Abstraction.createImplementation({
    implementation: AuthServiceImpl,
    dependencies: [DatabaseClient, UserService, EmailService]
});
