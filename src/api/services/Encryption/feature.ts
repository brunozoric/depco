import { createFeature } from "#shared/index.js";
import { EncryptionService } from "./EncryptionService.js";

export const EncryptionFeature = createFeature({
    name: "Api/EncryptionFeature",
    register(container) {
        container.register(EncryptionService).inSingletonScope();
    }
});
