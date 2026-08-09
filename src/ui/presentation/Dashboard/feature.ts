import { createFeature } from "#shared/index.js";
import { RouterFeature } from "../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../infrastructure/Router/abstractions/RouteRegistry.js";
import { DashboardRoute as DashboardRouteAbstraction } from "./Dashboard/abstractions/DashboardRoute.js";
import { DashboardRoute } from "./Dashboard/DashboardRoute.js";
import { DashboardPresentationFeature } from "./Dashboard/feature.js";
import { DashboardUseCasesFeature } from "./useCases/feature.js";

export const DashboardDomainFeature = createFeature({
    name: "Ui/Presentation/Dashboard",
    dependencies: [RouterFeature, DashboardPresentationFeature, DashboardUseCasesFeature],
    register(container) {
        container.register(DashboardRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(DashboardRouteAbstraction));
    }
});
