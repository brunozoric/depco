import { createFeature } from "#shared/index.js";
import { UpgradeService } from "./UpgradeService.js";

export const UpgradeFeature = createFeature({
    name: "Api/UpgradeFeature",
    register(container) {
        container.register(UpgradeService).inSingletonScope();
    }
});
