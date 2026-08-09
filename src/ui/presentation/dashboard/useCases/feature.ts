import { createFeature } from "#shared/index.js";
import { LoadDashboardUseCase } from "./LoadDashboardUseCase.js";
import { LoadVulnerabilityTrendUseCase } from "./LoadVulnerabilityTrendUseCase.js";
import { DashboardFeature } from "../../../features/Dashboard/feature.js";

export const DashboardUseCasesFeature = createFeature({
    name: "Ui/DashboardUseCases",
    dependencies: [DashboardFeature],
    register(container) {
        container.register(LoadDashboardUseCase);
        container.register(LoadVulnerabilityTrendUseCase);
    }
});
