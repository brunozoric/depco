import { createFeature } from "#shared/index.js";
import { PmSettingsPresenter as PmSettingsPresenterAbstraction } from "./abstractions/PmSettingsPresenter.js";
import { PmSettingsPresenter } from "./PmSettingsPresenter.js";
import { SecuritySettingsUseCasesFeature } from "../useCases/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { PmSettingsRoute as PmSettingsRouteAbstraction } from "./abstractions/PmSettingsRoute.js";
import { PmSettingsRoute } from "./PmSettingsRoute.js";

export interface IPmSettingsPresentationFeatureExports {
    presenter: PmSettingsPresenterAbstraction.Interface;
}

export const PmSettingsPresentationFeature = createFeature<
    void,
    IPmSettingsPresentationFeatureExports
>({
    name: "Ui/PmSettingsPresentation",
    dependencies: [RouterFeature, SecuritySettingsUseCasesFeature],
    register(container) {
        container.register(PmSettingsPresenter);
        container.register(PmSettingsRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(PmSettingsRouteAbstraction));
    },
    resolve(container): IPmSettingsPresentationFeatureExports {
        return {
            presenter: container.resolve(PmSettingsPresenterAbstraction)
        };
    }
});
