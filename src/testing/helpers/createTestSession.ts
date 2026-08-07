import { createHash, randomBytes } from "crypto";
import { hash } from "argon2";
import { generateId } from "@webiny/stdlib";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { users, sessions } from "#api/db/schema.js";
import type { UserPermission } from "#shared/users/index.js";

type TestDb = DatabaseClient.Interface["db"];

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ICreateTestSessionParams {
    db: TestDb;
    email?: string;
    displayName?: string;
    permission?: UserPermission;
}

export interface ICreateTestSessionResult {
    token: string;
    userId: string;
    email: string;
}

// Inserts a user + session directly into the DB and returns a raw session
// token, so route tests can authenticate with `Authorization: Bearer
// <token>` without going through the login/verify-code flow.
export async function createTestSession(
    params: ICreateTestSessionParams
): Promise<ICreateTestSessionResult> {
    const {
        db,
        email = `test-${generateId()}@example.com`,
        displayName = "Test User",
        permission = "full"
    } = params;
    const now = Date.now();
    const userId = generateId();

    await db
        .insert(users)
        .values({
            id: userId,
            email,
            passwordHash: await hash(randomBytes(16).toString("hex")),
            displayName,
            permission,
            isActive: 1,
            createdAt: now,
            updatedAt: now
        })
        .run();

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await db
        .insert(sessions)
        .values({
            id: generateId(),
            userId,
            tokenHash,
            expiresAt: now + SESSION_DURATION_MS,
            createdAt: now
        })
        .run();

    return { token: rawToken, userId, email };
}
