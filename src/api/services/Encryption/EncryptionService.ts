import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import argon2 from "argon2";
import { Env } from "@webiny/stdlib";
import { EncryptionService as Abstraction } from "./abstractions/EncryptionService.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = Buffer.from("dependency-manager-encryption-salt-v1");

class EncryptionServiceImpl implements Abstraction.Interface {
    private derivedKey: Buffer | null = null;
    private readonly encryptionKey: string | undefined;

    public constructor(env: Env.Interface) {
        this.encryptionKey = env.getString("ENCRYPTION_KEY");
    }

    public isAvailable(): boolean {
        return this.encryptionKey !== undefined;
    }

    public async encrypt(plaintext: string): Promise<string> {
        const key = await this.getDerivedKey();
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

        const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return Buffer.concat([iv, authTag, encrypted]).toString("base64");
    }

    public async decrypt(ciphertext: string): Promise<string> {
        const key = await this.getDerivedKey();
        const data = Buffer.from(ciphertext, "base64");

        const iv = data.subarray(0, IV_LENGTH);
        const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    }

    private async getDerivedKey(): Promise<Buffer> {
        if (!this.encryptionKey) {
            throw new Error("ENCRYPTION_KEY not set — cannot encrypt or decrypt tokens");
        }

        if (this.derivedKey) {
            return this.derivedKey;
        }

        const hash = await argon2.hash(this.encryptionKey, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
            salt: SALT,
            raw: true,
            hashLength: KEY_LENGTH
        });

        this.derivedKey = Buffer.from(hash);
        return this.derivedKey;
    }
}

export const EncryptionService = Abstraction.createImplementation({
    implementation: EncryptionServiceImpl,
    dependencies: [Env]
});
