import { createFeature } from "#shared/index.js";

import { ScanSchedulesUseCasesFeature } from "./useCases/feature.js";

export const ScanSchedulesDomainFeature = createFeature({
    name: "Ui/Presentation/ScanSchedules",
    dependencies: [ScanSchedulesUseCasesFeature],
    register() {}
});
