import { createFeature } from "#shared/index.js";
import { AppSettingsPresenter as AppSettingsPresenterAbstraction } from "./abstractions/AppSettingsPresenter.js";
import { AppSettingsPresenter } from "./AppSettingsPresenter.js";
import { AppSettingsUseCasesFeature } from "../appSettingsUseCases/feature.js";
import { AppSettingsRoute } from "./AppSettingsRoute.js";

export interface IAppSettingsPresentationFeatureExports {
    presenter: AppSettingsPresenterAbstraction.Interface;
}

export const AppSettingsPresentationFeature = createFeature<
    void,
    IAppSettingsPresentationFeatureExports
>({
    name: "Ui/AppSettingsPresentation",
    dependencies: [AppSettingsUseCasesFeature],
    register(container) {
        container.register(AppSettingsPresenter);
        container.register(AppSettingsRoute).inSingletonScope();
    },
    resolve(container) {
        return {
            presenter: container.resolve(AppSettingsPresenterAbstraction)
        };
    }
});
