import { createFeature } from "#shared/index.js";
import { DashboardGateway } from "./DashboardGateway.js";
import { DashboardRepository } from "./DashboardRepository.js";

export const DashboardFeature = createFeature({
    name: "Ui/Dashboard",
    register(container) {
        container.register(DashboardGateway).inSingletonScope();
        container.register(DashboardRepository).inSingletonScope();
    }
});
