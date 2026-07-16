import { createAbstraction } from "#shared/index.js";
import type { DashboardPresenter } from "../../../dashboard/Dashboard/abstractions/DashboardPresenter.js";

export interface ITeamDetailViewModel {
    loading: boolean;
    error: string | null;
    teamName: string;
    teamColor: string;
    projectCount: number;
}

export interface ITeamDetailPresenter {
    get vm(): ITeamDetailViewModel;
    get dashboardPresenter(): DashboardPresenter.Interface;
    load(teamId: string): Promise<void>;
    dispose(): void;
}

export const TeamDetailPresenter =
    createAbstraction<ITeamDetailPresenter>("Ui/TeamDetailPresenter");

export namespace TeamDetailPresenter {
    export type Interface = ITeamDetailPresenter;
    export type ViewModel = ITeamDetailViewModel;
}
