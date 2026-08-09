import { createFeature } from "#shared/index.js";
import { DashboardPresenter as DashboardPresenterAbstraction } from "./abstractions/DashboardPresenter.js";
import { DashboardPresenter } from "./DashboardPresenter.js";
import { DashboardUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { DashboardRoute as DashboardRouteAbstraction } from "./abstractions/DashboardRoute.js";
import { DashboardRoute } from "./DashboardRoute.js";

export interface IDashboardPresentationFeatureExports {
    presenter: DashboardPresenterAbstraction.Interface;
}

export const DashboardPresentationFeature = createFeature<
    void,
    IDashboardPresentationFeatureExports
>({
    name: "Ui/DashboardPresentation",
    dependencies: [RouterFeature, DashboardUseCasesFeature, WebSocketFeature, TeamFilterFeature],
    register(container) {
        container.register(DashboardPresenter);
        container.register(DashboardRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(DashboardRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(DashboardPresenterAbstraction)
        };
    }
});
