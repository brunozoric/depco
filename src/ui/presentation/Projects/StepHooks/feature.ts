import { createFeature } from "#shared/index.js";
import { StepHooksPresenter as StepHooksPresenterAbstraction } from "./abstractions/StepHooksPresenter.js";
import { StepHooksPresenter } from "./StepHooksPresenter.js";
import { StepHooksFeature as StepHooksHeadlessFeature } from "../../../features/StepHooks/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { StepHooksRoute as StepHooksRouteAbstraction } from "./abstractions/StepHooksRoute.js";
import { StepHooksRoute } from "./StepHooksRoute.js";

export interface IStepHooksPresentationFeatureExports {
    presenter: StepHooksPresenterAbstraction.Interface;
}

export const StepHooksPresentationFeature = createFeature<
    void,
    IStepHooksPresentationFeatureExports
>({
    name: "Ui/StepHooksPresentation",
    dependencies: [RouterFeature, StepHooksHeadlessFeature],
    register(container) {
        container.register(StepHooksPresenter);
        container.register(StepHooksRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(StepHooksRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(StepHooksPresenterAbstraction)
        };
    }
});
