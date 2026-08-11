import { createFeature } from "#shared/index.js";
import { DashboardRoute } from "./Dashboard/DashboardRoute.js";
import { DashboardPresentationFeature } from "./Dashboard/feature.js";
import { DashboardUseCasesFeature } from "./useCases/feature.js";

export const DashboardDomainFeature = createFeature({
    name: "Ui/Presentation/Dashboard",
    dependencies: [DashboardPresentationFeature, DashboardUseCasesFeature],
    register(container) {
        container.register(DashboardRoute).inSingletonScope();
    }
});
