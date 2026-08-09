import { createFeature } from "#shared/index.js";
import { TeamsPresenter as TeamsPresenterAbstraction } from "./abstractions/TeamsPresenter.js";
import { TeamsPresenter } from "./TeamsPresenter.js";
import { TeamsUseCasesFeature } from "../useCases/feature.js";
import { TeamsFeature } from "../../../features/Teams/feature.js";

export interface ITeamsPageFeatureExports {
    presenter: TeamsPresenterAbstraction.Interface;
}

export const TeamsPageFeature = createFeature<void, ITeamsPageFeatureExports>({
    name: "Ui/TeamsPage",
    dependencies: [TeamsUseCasesFeature, TeamsFeature],
    register(container) {
        container.register(TeamsPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(TeamsPresenterAbstraction)
        };
    }
});
