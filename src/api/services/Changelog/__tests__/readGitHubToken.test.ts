import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { appSettings } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { readGitHubToken } from "../resolvers/readGitHubToken.js";

describe("readGitHubToken", () => {
    it("returns the decrypted token when github_token is configured", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        const encrypted = await encryptionService.encrypt("ghp_test123");
        await db.insert(appSettings).values({ key: "github_token", value: encrypted }).run();

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBe("ghp_test123");
    });

    it("returns null when github_token is not configured", async () => {
        const { container } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBeNull();
    });

    it("returns null when github_token value is empty", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        await db.insert(appSettings).values({ key: "github_token", value: "" }).run();

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBeNull();
    });

    it("returns null when decryption fails", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const databaseClient = container.resolve(DatabaseClient);
        const failingEncryptionService: EncryptionService.Interface = {
            encrypt: async () => "",
            decrypt: async () => {
                throw new Error("decryption failed");
            },
            isAvailable: () => true
        };

        await db.insert(appSettings).values({ key: "github_token", value: "invalid-cipher" }).run();

        const result = await readGitHubToken({
            databaseClient,
            encryptionService: failingEncryptionService
        });

        expect(result.token).toBeNull();
    });
});
