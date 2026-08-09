import { createFeature } from "#shared/index.js";
import { TeamDetailPresenter as TeamDetailPresenterAbstraction } from "./abstractions/TeamDetailPresenter.js";
import { TeamDetailPresenter } from "./TeamDetailPresenter.js";
import { TeamsFeature } from "../../../features/Teams/feature.js";
import { DashboardPresentationFeature } from "../../Dashboard/Dashboard/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { TeamDetailRoute as TeamDetailRouteAbstraction } from "./abstractions/TeamDetailRoute.js";
import { TeamDetailRoute } from "./TeamDetailRoute.js";

export interface ITeamDetailFeatureExports {
    presenter: TeamDetailPresenterAbstraction.Interface;
}

export const TeamDetailFeature = createFeature<void, ITeamDetailFeatureExports>({
    name: "Ui/TeamDetail",
    dependencies: [RouterFeature, TeamsFeature, DashboardPresentationFeature, TeamFilterFeature],
    register(container) {
        container.register(TeamDetailPresenter);
        container.register(TeamDetailRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(TeamDetailRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(TeamDetailPresenterAbstraction)
        };
    }
});
