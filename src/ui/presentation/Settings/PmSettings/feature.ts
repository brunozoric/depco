import { createFeature } from "#shared/index.js";
import { PmSettingsPresenter as PmSettingsPresenterAbstraction } from "./abstractions/PmSettingsPresenter.js";
import { PmSettingsPresenter } from "./PmSettingsPresenter.js";
import { SecuritySettingsUseCasesFeature } from "../useCases/feature.js";

export interface IPmSettingsPresentationFeatureExports {
    presenter: PmSettingsPresenterAbstraction.Interface;
}

export const PmSettingsPresentationFeature = createFeature<
    void,
    IPmSettingsPresentationFeatureExports
>({
    name: "Ui/PmSettingsPresentation",
    dependencies: [SecuritySettingsUseCasesFeature],
    register(container) {
        container.register(PmSettingsPresenter);
    },
    resolve(container): IPmSettingsPresentationFeatureExports {
        return {
            presenter: container.resolve(PmSettingsPresenterAbstraction)
        };
    }
});
