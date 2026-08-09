import { createFeature } from "#shared/index.js";
import { UrlFilterService } from "./UrlFilterService.js";

export const UrlFilterFeature = createFeature({
    name: "Ui/UrlFilter",
    register(container) {
        container.register(UrlFilterService).inSingletonScope();
    }
});
