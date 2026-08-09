import { createFeature } from "#shared/index.js";
import { LogBrowserPresenter as LogBrowserPresenterAbstraction } from "./abstractions/LogBrowserPresenter.js";
import { LogBrowserPresenter } from "./LogBrowserPresenter.js";
import { AppLogsUseCasesFeature } from "../useCases/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../../Projects/useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { LogBrowserRoute as LogBrowserRouteAbstraction } from "./abstractions/LogBrowserRoute.js";
import { LogBrowserRoute } from "./LogBrowserRoute.js";

export interface ILogBrowserPresentationFeatureExports {
    presenter: LogBrowserPresenterAbstraction.Interface;
}

export const LogBrowserPresentationFeature = createFeature<
    void,
    ILogBrowserPresentationFeatureExports
>({
    name: "Ui/LogBrowserPresentation",
    dependencies: [
        RouterFeature,
        AppLogsUseCasesFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        WebSocketFeature
    ],
    register(container) {
        container.register(LogBrowserPresenter);
        container.register(LogBrowserRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(LogBrowserRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(LogBrowserPresenterAbstraction)
        };
    }
});
