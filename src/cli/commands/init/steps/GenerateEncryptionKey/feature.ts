import { createFeature } from "#shared/index.js";
import { GenerateEncryptionKeyStep } from "./GenerateEncryptionKeyStep.js";

export const GenerateEncryptionKeyStepFeature = createFeature({
    name: "Cli/GenerateEncryptionKeyStep",
    register(container) {
        container.register(GenerateEncryptionKeyStep).inSingletonScope();
    }
});
