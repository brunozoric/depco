import { createFeature } from "#shared/index.js";
import { JobProgressPresenter as JobProgressPresenterAbstraction } from "./abstractions/JobProgressPresenter.js";
import { JobProgressPresenter } from "./JobProgressPresenter.js";
import { UpgradesUseCasesFeature } from "../../Upgrades/useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";

export interface IJobProgressFeatureExports {
    presenter: JobProgressPresenterAbstraction.Interface;
}

export const JobProgressFeature = createFeature<void, IJobProgressFeatureExports>({
    name: "Ui/JobProgress",
    dependencies: [UpgradesUseCasesFeature, WebSocketFeature],
    register(container) {
        container.register(JobProgressPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(JobProgressPresenterAbstraction)
        };
    }
});
