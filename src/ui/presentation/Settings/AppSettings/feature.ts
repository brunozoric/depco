import { createFeature } from "#shared/index.js";
import { AppSettingsPresenter as AppSettingsPresenterAbstraction } from "./abstractions/AppSettingsPresenter.js";
import { AppSettingsPresenter } from "./AppSettingsPresenter.js";
import { AppSettingsUseCasesFeature } from "../appSettingsUseCases/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { AppSettingsRoute as AppSettingsRouteAbstraction } from "./abstractions/AppSettingsRoute.js";
import { AppSettingsRoute } from "./AppSettingsRoute.js";

export interface IAppSettingsPresentationFeatureExports {
    presenter: AppSettingsPresenterAbstraction.Interface;
}

export const AppSettingsPresentationFeature = createFeature<
    void,
    IAppSettingsPresentationFeatureExports
>({
    name: "Ui/AppSettingsPresentation",
    dependencies: [RouterFeature, AppSettingsUseCasesFeature],
    register(container) {
        container.register(AppSettingsPresenter);
        container.register(AppSettingsRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(AppSettingsRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(AppSettingsPresenterAbstraction)
        };
    }
});
