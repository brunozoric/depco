import { createFeature } from "#shared/index.js";
import { ScanSchedulesGateway } from "./ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "./ScanSchedulesRepository.js";

export const ScanSchedulesFeature = createFeature({
    name: "Ui/ScanSchedules",
    register(container) {
        container.register(ScanSchedulesGateway).inSingletonScope();
        container.register(ScanSchedulesRepository).inSingletonScope();
    }
});
