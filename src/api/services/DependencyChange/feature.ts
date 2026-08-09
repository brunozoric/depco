import { createFeature } from "#shared/index.js";
import { DependencyChangeService } from "./DependencyChangeService.js";

export const DependencyChangeFeature = createFeature({
    name: "Api/DependencyChangeFeature",
    register(container) {
        container.register(DependencyChangeService).inSingletonScope();
    }
});
