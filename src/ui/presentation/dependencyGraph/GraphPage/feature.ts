import { createFeature } from "#shared/index.js";
import { DependencyGraphPresenter as DependencyGraphPresenterAbstraction } from "./abstractions/DependencyGraphPresenter.js";
import { DependencyGraphPresenter } from "./DependencyGraphPresenter.js";
import { DependencyGraphUseCasesFeature } from "../useCases/feature.js";
import { DependencyGraphFeature } from "../../../features/dependencyGraph/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";

export interface IDependencyGraphPageFeatureExports {
    presenter: DependencyGraphPresenterAbstraction.Interface;
}

export const DependencyGraphPageFeature = createFeature<void, IDependencyGraphPageFeatureExports>({
    name: "Ui/DependencyGraphPage",
    dependencies: [DependencyGraphUseCasesFeature, DependencyGraphFeature, WebSocketFeature],
    register(container) {
        container.register(DependencyGraphPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(DependencyGraphPresenterAbstraction)
        };
    }
});
