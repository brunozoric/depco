import { createFeature } from "#shared/index.js";
import { ScanSchedulerService } from "./ScanSchedulerService.js";

export const ScanSchedulerFeature = createFeature({
    name: "Api/ScanSchedulerFeature",
    register(container) {
        container.register(ScanSchedulerService).inSingletonScope();
    }
});
