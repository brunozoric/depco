import { randomBytes, randomInt } from "crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { EmailService } from "../Email/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { loginCodes } from "#api/db/schema.js";
import { HttpError } from "#api/errors/HttpError.js";
import { hashToken } from "./tokenHash.js";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface IIssueEmailCodeInput {
    userId: string;
    email: string;
}

export interface IVerifyEmailCodeInput {
    userId: string;
    code: string;
}

export interface IIssueMagicLinkInput {
    userId: string;
    email: string;
    baseUrl: string;
}

export interface IVerifyMagicLinkTokenInput {
    userId: string;
    token: string;
}

function generateCode(): string {
    return randomInt(0, 1000000).toString().padStart(6, "0");
}

/**
 * Issuing and verifying single-use `loginCodes` rows — both the 6-digit
 * email codes and the hashed magic-link tokens. Internal helper for
 * AuthServiceImpl — not DI-registered.
 */
export class LoginCodeManager {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly emailService: EmailService.Interface
    ) {}

    public async issueEmailCode(input: IIssueEmailCodeInput): Promise<void> {
        const code = generateCode();
        const now = Date.now();

        await this.databaseClient.db
            .insert(loginCodes)
            .values({
                id: generateId(),
                userId: input.userId,
                code,
                type: "email-code",
                expiresAt: now + CODE_TTL_MS,
                createdAt: now
            })
            .run();

        await this.emailService.send({
            to: input.email,
            subject: "Your login code",
            text: `Your verification code is: ${code}`
        });
    }

    public async verifyEmailCode(input: IVerifyEmailCodeInput): Promise<void> {
        const now = Date.now();
        const codeRow = await this.databaseClient.db
            .select()
            .from(loginCodes)
            .where(
                and(
                    eq(loginCodes.userId, input.userId),
                    eq(loginCodes.code, input.code),
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
    }

    public async issueMagicLink(input: IIssueMagicLinkInput): Promise<void> {
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const now = Date.now();

        await this.databaseClient.db
            .insert(loginCodes)
            .values({
                id: generateId(),
                userId: input.userId,
                code: tokenHash,
                type: "magic-link",
                expiresAt: now + CODE_TTL_MS,
                createdAt: now
            })
            .run();

        const link = `${input.baseUrl}?token=${rawToken}&email=${encodeURIComponent(input.email)}`;

        await this.emailService.send({
            to: input.email,
            subject: "Your login link",
            text: `Click the link below to log in:\n\n${link}`,
            html: `<p><a href="${link}">Click here to log in</a></p>`
        });
    }

    public async verifyMagicLinkToken(input: IVerifyMagicLinkTokenInput): Promise<void> {
        const now = Date.now();
        const tokenHash = hashToken(input.token);
        const codeRow = await this.databaseClient.db
            .select()
            .from(loginCodes)
            .where(
                and(
                    eq(loginCodes.userId, input.userId),
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
    }

    public async cleanupExpiredCodes(): Promise<void> {
        const now = Date.now();
        await this.databaseClient.db.delete(loginCodes).where(lt(loginCodes.expiresAt, now)).run();
    }
}
