import { createFeature } from "#shared/index.js";
import { ScanService } from "./ScanService.js";

export const ScanFeature = createFeature({
    name: "Api/ScanFeature",
    register(container) {
        container.register(ScanService).inSingletonScope();
    }
});
