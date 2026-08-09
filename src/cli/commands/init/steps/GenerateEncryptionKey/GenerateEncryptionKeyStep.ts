import { randomBytes } from "node:crypto";
import { GenerateEncryptionKeyStep as Abstraction } from "./abstractions/GenerateEncryptionKeyStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class GenerateEncryptionKeyStepImpl implements Abstraction.Interface {
    public name = "generate-encryption-key";
    public description = "Generate encryption key";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const key = randomBytes(32).toString("hex");
        context.results.set("encryptionKey", key);
        return { success: true };
    }
}

export const GenerateEncryptionKeyStep = Abstraction.createImplementation({
    implementation: GenerateEncryptionKeyStepImpl,
    dependencies: []
});
