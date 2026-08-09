import { createFeature } from "#shared/index.js";
import { AppLogService } from "./AppLogService.js";

export const AppLogFeature = createFeature({
    name: "Api/AppLogFeature",
    register(container) {
        container.register(AppLogService).inSingletonScope();
    }
});
