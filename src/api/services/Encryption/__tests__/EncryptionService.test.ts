import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { ProcessEnvFeature } from "@webiny/stdlib/node";
import { EncryptionService } from "../abstractions/EncryptionService.js";
import { EncryptionService as EncryptionServiceImpl } from "../EncryptionService.js";

function createService(encryptionKey?: string): EncryptionService.Interface {
    const container = createContainer();
    ProcessEnvFeature.register(container, {
        variables: {
            ...process.env,
            ...(encryptionKey !== undefined ? { ENCRYPTION_KEY: encryptionKey } : {})
        }
    });
    container.register(EncryptionServiceImpl).inSingletonScope();
    return container.resolve(EncryptionService);
}

describe("EncryptionService", () => {
    it("encrypts and decrypts a string round-trip", async () => {
        const service = createService("test-secret-key-123");

        const encrypted = await service.encrypt("Hello, World!");
        const decrypted = await service.decrypt(encrypted);

        expect(decrypted).toBe("Hello, World!");
    });

    it("produces different ciphertext for same plaintext (random IV)", async () => {
        const service = createService("test-secret-key-123");

        const first = await service.encrypt("same input");
        const second = await service.encrypt("same input");

        expect(first).not.toBe(second);
    });

    it("decrypts to correct value with same key across instances", async () => {
        const service1 = createService("shared-key");
        const encrypted = await service1.encrypt("secret data");

        const service2 = createService("shared-key");
        const decrypted = await service2.decrypt(encrypted);

        expect(decrypted).toBe("secret data");
    });

    it("fails to decrypt with wrong key", async () => {
        const encryptor = createService("key-one");
        const encrypted = await encryptor.encrypt("secret");

        const decryptor = createService("key-two");
        await expect(decryptor.decrypt(encrypted)).rejects.toThrow();
    });

    it("handles empty string", async () => {
        const service = createService("test-key");

        const encrypted = await service.encrypt("");
        const decrypted = await service.decrypt(encrypted);

        expect(decrypted).toBe("");
    });

    it("handles unicode content", async () => {
        const service = createService("test-key");
        const plaintext = "Hello! Привет мир 你好世界";

        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
    });

    it("reports availability when key is set", () => {
        const service = createService("some-key");
        expect(service.isAvailable()).toBe(true);
    });

    it("throws when encrypting without key", async () => {
        const service = createService(undefined);
        await expect(service.encrypt("data")).rejects.toThrow("ENCRYPTION_KEY not set");
    });
});
