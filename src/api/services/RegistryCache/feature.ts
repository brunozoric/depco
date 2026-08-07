import { createFeature } from "#shared/index.js";
import { RegistryCacheService } from "./RegistryCacheService.js";

export const RegistryCacheFeature = createFeature({
    name: "Api/RegistryCacheFeature",
    register(container) {
        container.register(RegistryCacheService).inSingletonScope();
    }
});
