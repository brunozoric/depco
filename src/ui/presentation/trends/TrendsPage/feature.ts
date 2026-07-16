import { createFeature } from "#shared/index.js";
import { TrendsPresenter as TrendsPresenterAbstraction } from "./abstractions/TrendsPresenter.js";
import { TrendsPresenter } from "./TrendsPresenter.js";
import { TrendsUseCasesFeature } from "../useCases/feature.js";
import { TrendsFeature } from "../../../features/trends/feature.js";
import { ProjectsFeature } from "../../../features/projects/feature.js";
import { ProjectsUseCasesFeature } from "../../projects/useCases/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

export interface ITrendsPageFeatureExports {
    presenter: TrendsPresenterAbstraction.Interface;
}

export const TrendsPageFeature = createFeature<void, ITrendsPageFeatureExports>({
    name: "Ui/TrendsPage",
    dependencies: [
        TrendsUseCasesFeature,
        TrendsFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        TeamFilterFeature
    ],
    register(container) {
        container.register(TrendsPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(TrendsPresenterAbstraction)
        };
    }
});
