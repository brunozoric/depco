import { createFeature } from "#shared/index.js";
import { DependencyGraphPresenter as DependencyGraphPresenterAbstraction } from "./abstractions/DependencyGraphPresenter.js";
import { DependencyGraphPresenter } from "./DependencyGraphPresenter.js";
import { DependencyGraphUseCasesFeature } from "../useCases/feature.js";
import { DependencyGraphFeature } from "../../../features/DependencyGraph/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { DependencyGraphRoute as DependencyGraphRouteAbstraction } from "./abstractions/DependencyGraphRoute.js";
import { DependencyGraphRoute } from "./DependencyGraphRoute.js";

export interface IDependencyGraphPageFeatureExports {
    presenter: DependencyGraphPresenterAbstraction.Interface;
}

export const DependencyGraphPageFeature = createFeature<void, IDependencyGraphPageFeatureExports>({
    name: "Ui/DependencyGraphPage",
    dependencies: [
        RouterFeature,
        DependencyGraphUseCasesFeature,
        DependencyGraphFeature,
        WebSocketFeature
    ],
    register(container) {
        container.register(DependencyGraphPresenter);
        container.register(DependencyGraphRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(DependencyGraphRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(DependencyGraphPresenterAbstraction)
        };
    }
});
