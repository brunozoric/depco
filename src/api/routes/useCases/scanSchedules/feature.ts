import { createFeature } from "#shared/index.js";
import { ListScanSchedulesUseCase } from "./ListScanSchedulesUseCase.js";
import { UpsertScanScheduleUseCase } from "./UpsertScanScheduleUseCase.js";
import { DeleteScanScheduleUseCase } from "./DeleteScanScheduleUseCase.js";
import { GetScanScheduleDefaultUseCase } from "./GetScanScheduleDefaultUseCase.js";
import { UpsertScanScheduleDefaultUseCase } from "./UpsertScanScheduleDefaultUseCase.js";

export const ScanSchedulesUseCasesFeature = createFeature({
    name: "Api/ScanSchedulesUseCasesFeature",
    register(container) {
        container.register(ListScanSchedulesUseCase);
        container.register(UpsertScanScheduleUseCase);
        container.register(DeleteScanScheduleUseCase);
        container.register(GetScanScheduleDefaultUseCase);
        container.register(UpsertScanScheduleDefaultUseCase);
    }
});
