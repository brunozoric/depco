import type { Container } from "@webiny/di";
import { ProcessEnvFeature } from "@webiny/stdlib/node";
import { EncryptionService } from "#api/services/Encryption/EncryptionService.js";

export function registerEncryption(container: Container): void {
    ProcessEnvFeature.register(container, {
        variables: { ...process.env, ENCRYPTION_KEY: "test-encryption-key-for-tests" }
    });
    container.register(EncryptionService).inSingletonScope();
}
