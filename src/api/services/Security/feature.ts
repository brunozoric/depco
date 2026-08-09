import { createFeature } from "#shared/index.js";
import { SecurityService } from "./SecurityService.js";

export const SecurityFeature = createFeature({
    name: "Api/SecurityFeature",
    register(container) {
        container.register(SecurityService).inSingletonScope();
    }
});
