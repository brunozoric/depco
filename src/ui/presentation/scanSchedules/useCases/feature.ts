import { createFeature } from "#shared/index.js";
import { ScanSchedulesFeature } from "../../../features/scanSchedules/index.js";
import { LoadScanSchedulesUseCase } from "./LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase } from "./UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase } from "./ResetScanScheduleUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "./UpdateScanScheduleDefaultUseCase.js";

export const ScanSchedulesUseCasesFeature = createFeature({
    name: "Ui/ScanSchedulesUseCases",
    dependencies: [ScanSchedulesFeature],
    register(container) {
        container.register(LoadScanSchedulesUseCase).inSingletonScope();
        container.register(UpdateScanScheduleUseCase).inSingletonScope();
        container.register(ResetScanScheduleUseCase).inSingletonScope();
        container.register(UpdateScanScheduleDefaultUseCase).inSingletonScope();
    }
});
