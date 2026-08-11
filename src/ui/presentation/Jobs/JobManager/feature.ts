import { createFeature } from "#shared/index.js";
import { JobManagerPresenter as JobManagerPresenterAbstraction } from "./abstractions/JobManagerPresenter.js";
import { JobManagerPresenter } from "./JobManagerPresenter.js";
import { JobManagerUseCasesFeature } from "./useCases/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../../Projects/useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { JobManagerRoute } from "./JobManagerRoute.js";

export interface IJobManagerFeatureExports {
    presenter: JobManagerPresenterAbstraction.Interface;
}

export const JobManagerPresentationFeature = createFeature<void, IJobManagerFeatureExports>({
    name: "Ui/JobManagerPresentation",
    dependencies: [
        JobManagerUseCasesFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        WebSocketFeature
    ],
    register(container) {
        container.register(JobManagerPresenter);
        container.register(JobManagerRoute).inSingletonScope();
    },
    resolve(container) {
        return {
            presenter: container.resolve(JobManagerPresenterAbstraction)
        };
    }
});
