import { createFeature } from "#shared/index.js";
import { StepHooksPresenter as StepHooksPresenterAbstraction } from "./abstractions/StepHooksPresenter.js";
import { StepHooksPresenter } from "./StepHooksPresenter.js";
import { StepHooksFeature as StepHooksHeadlessFeature } from "../../../features/StepHooks/feature.js";
import { StepHooksRoute } from "./StepHooksRoute.js";

export interface IStepHooksPresentationFeatureExports {
    presenter: StepHooksPresenterAbstraction.Interface;
}

export const StepHooksPresentationFeature = createFeature<
    void,
    IStepHooksPresentationFeatureExports
>({
    name: "Ui/StepHooksPresentation",
    dependencies: [StepHooksHeadlessFeature],
    register(container) {
        container.register(StepHooksPresenter);
        container.register(StepHooksRoute).inSingletonScope();
    },
    resolve(container) {
        return {
            presenter: container.resolve(StepHooksPresenterAbstraction)
        };
    }
});
