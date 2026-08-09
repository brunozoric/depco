import { createFeature } from "#shared/index.js";
import { TeamsPresenter as TeamsPresenterAbstraction } from "./abstractions/TeamsPresenter.js";
import { TeamsPresenter } from "./TeamsPresenter.js";
import { TeamsUseCasesFeature } from "../useCases/feature.js";
import { TeamsFeature } from "../../../features/Teams/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { TeamsRoute as TeamsRouteAbstraction } from "./abstractions/TeamsRoute.js";
import { TeamsRoute } from "./TeamsRoute.js";

export interface ITeamsPageFeatureExports {
    presenter: TeamsPresenterAbstraction.Interface;
}

export const TeamsPageFeature = createFeature<void, ITeamsPageFeatureExports>({
    name: "Ui/TeamsPage",
    dependencies: [RouterFeature, TeamsUseCasesFeature, TeamsFeature],
    register(container) {
        container.register(TeamsPresenter);
        container.register(TeamsRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(TeamsRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(TeamsPresenterAbstraction)
        };
    }
});
