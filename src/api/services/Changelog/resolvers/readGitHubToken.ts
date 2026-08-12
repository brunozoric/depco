import { eq } from "drizzle-orm";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { appSettings } from "#api/db/schema.js";

export interface IReadGitHubTokenInput {
    databaseClient: DatabaseClient.Interface;
    encryptionService: EncryptionService.Interface;
}

export interface IGitHubTokenResult {
    token: string | null;
}

export async function readGitHubToken(input: IReadGitHubTokenInput): Promise<IGitHubTokenResult> {
    const { databaseClient, encryptionService } = input;

    const row = await databaseClient.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "github_token"))
        .get();

    if (!row?.value) {
        return { token: null };
    }

    try {
        const token = await encryptionService.decrypt(row.value);
        return { token };
    } catch {
        return { token: null };
    }
}
