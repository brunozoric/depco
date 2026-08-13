import { describe, it, expect, vi } from "vitest";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { appSettings } from "#api/db/schema.js";
import { EncryptionService } from "#api/services/Encryption/index.js";
import { UpsertAppSettingUseCase } from "../abstractions/UpsertAppSettingUseCase.js";

function createStubEncryptionService(
    overrides: Partial<EncryptionService.Interface> = {}
): EncryptionService.Interface {
    return {
        isAvailable: () => true,
        encrypt: async (plaintext: string) => `encrypted:${plaintext}`,
        decrypt: async (ciphertext: string) => ciphertext.replace("encrypted:", ""),
        ...overrides
    };
}

function createUseCase(encryptionService: EncryptionService.Interface): {
    useCase: UpsertAppSettingUseCase.Interface;
    db: BetterSQLite3Database;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(EncryptionService, encryptionService);
    return { useCase: container.resolve(UpsertAppSettingUseCase), db };
}

describe("UpsertAppSettingUseCase", () => {
    it("stores a plain (non-token) key as-is and returns it unmasked", async () => {
        const { useCase, db } = createUseCase(createStubEncryptionService());

        const result = await useCase.execute({
            key: "branch_template",
            value: "feature/{{PACKAGE}}"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual({ key: "branch_template", value: "feature/{{PACKAGE}}" });

        const row = await db.select().from(appSettings).all();
        expect(row).toEqual([{ key: "branch_template", value: "feature/{{PACKAGE}}" }]);
    });

    it("encrypts a token value and returns a masked response", async () => {
        const encryptionService = createStubEncryptionService();
        const { useCase, db } = createUseCase(encryptionService);

        const result = await useCase.execute({ key: "github_token", value: "ghp_secret" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual({ key: "github_token", value: "••••••••" });

        const row = await db.select().from(appSettings).all();
        expect(row[0]?.value).toBe("encrypted:ghp_secret");
    });

    it("fails with 400 when encryption is unavailable for a token key", async () => {
        const { useCase } = createUseCase(
            createStubEncryptionService({ isAvailable: () => false })
        );

        const result = await useCase.execute({ key: "gitlab_token", value: "glpat_secret" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toContain("ENCRYPTION_KEY");
    });

    it("fails with 500 when encryption throws", async () => {
        const { useCase } = createUseCase(
            createStubEncryptionService({
                encrypt: vi.fn(async () => {
                    throw new Error("encryption failure");
                })
            })
        );

        const result = await useCase.execute({ key: "github_token", value: "ghp_secret" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toBe("encryption failure");
    });

    it("updates an existing key on conflict", async () => {
        const { useCase, db } = createUseCase(createStubEncryptionService());

        await useCase.execute({ key: "log_level", value: "info" });
        await useCase.execute({ key: "log_level", value: "warn" });

        const rows = await db.select().from(appSettings).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.value).toBe("warn");
    });
});
