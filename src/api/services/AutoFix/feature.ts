import { createFeature } from "#shared/index.js";
import { AutoFixSettingsService } from "./AutoFixSettingsService.js";
import { AutoFixPrService } from "./AutoFixPrService.js";

export const AutoFixFeature = createFeature({
    name: "Api/AutoFixFeature",
    register(container) {
        container.register(AutoFixSettingsService).inSingletonScope();
        container.register(AutoFixPrService).inSingletonScope();
    }
});
