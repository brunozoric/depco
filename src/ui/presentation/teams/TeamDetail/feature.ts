import { createFeature } from "#shared/index.js";
import { TeamDetailPresenter as TeamDetailPresenterAbstraction } from "./abstractions/TeamDetailPresenter.js";
import { TeamDetailPresenter } from "./TeamDetailPresenter.js";
import { TeamsFeature } from "../../../features/teams/feature.js";
import { DashboardPresentationFeature } from "../../dashboard/Dashboard/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

export interface ITeamDetailFeatureExports {
    presenter: TeamDetailPresenterAbstraction.Interface;
}

export const TeamDetailFeature = createFeature<void, ITeamDetailFeatureExports>({
    name: "Ui/TeamDetail",
    dependencies: [TeamsFeature, DashboardPresentationFeature, TeamFilterFeature],
    register(container) {
        container.register(TeamDetailPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(TeamDetailPresenterAbstraction)
        };
    }
});
