import { createFeature } from "#shared/index.js";
import { DashboardPresenter as DashboardPresenterAbstraction } from "./abstractions/DashboardPresenter.js";
import { DashboardPresenter } from "./DashboardPresenter.js";
import { DashboardUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

export interface IDashboardPresentationFeatureExports {
    presenter: DashboardPresenterAbstraction.Interface;
}

export const DashboardPresentationFeature = createFeature<
    void,
    IDashboardPresentationFeatureExports
>({
    name: "Ui/DashboardPresentation",
    dependencies: [DashboardUseCasesFeature, WebSocketFeature, TeamFilterFeature],
    register(container) {
        container.register(DashboardPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(DashboardPresenterAbstraction)
        };
    }
});
