import { createFeature } from "#shared/index.js";

import { DashboardPresentationFeature } from "./Dashboard/feature.js";
import { DashboardUseCasesFeature } from "./useCases/feature.js";

export const DashboardDomainFeature = createFeature({
    name: "Ui/Presentation/Dashboard",
    dependencies: [DashboardPresentationFeature, DashboardUseCasesFeature],
    register() {}
});
