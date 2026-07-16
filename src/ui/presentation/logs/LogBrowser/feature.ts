import { createFeature } from "#shared/index.js";
import { LogBrowserPresenter as LogBrowserPresenterAbstraction } from "./abstractions/LogBrowserPresenter.js";
import { LogBrowserPresenter } from "./LogBrowserPresenter.js";
import { AppLogsUseCasesFeature } from "../useCases/feature.js";
import { ProjectsFeature } from "../../../features/projects/feature.js";
import { ProjectsUseCasesFeature } from "../../projects/useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";

export interface ILogBrowserPresentationFeatureExports {
    presenter: LogBrowserPresenterAbstraction.Interface;
}

export const LogBrowserPresentationFeature = createFeature<
    void,
    ILogBrowserPresentationFeatureExports
>({
    name: "Ui/LogBrowserPresentation",
    dependencies: [
        AppLogsUseCasesFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        WebSocketFeature
    ],
    register(container) {
        container.register(LogBrowserPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(LogBrowserPresenterAbstraction)
        };
    }
});
