import { createAbstraction } from "#shared/index.js";

export interface IEncryptionService {
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
    isAvailable(): boolean;
}

export const EncryptionService = createAbstraction<IEncryptionService>("Api/EncryptionService");

export namespace EncryptionService {
    export type Interface = IEncryptionService;
}
