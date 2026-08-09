import { computed, makeAutoObservable, runInAction } from "mobx";
import { TeamDetailPresenter as Abstraction } from "./abstractions/TeamDetailPresenter.js";
import { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";
import { DashboardPresenter } from "../../Dashboard/Dashboard/abstractions/DashboardPresenter.js";

class TeamDetailPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private teamName = "";
    private teamColor = "";
    private projectCount = 0;
    private previousTeamId: string | null = null;

    public constructor(
        private readonly teamsGateway: TeamsGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        private readonly dashboard: DashboardPresenter.Interface
    ) {
        makeAutoObservable(this, { vm: computed, dashboardPresenter: false });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            teamName: this.teamName,
            teamColor: this.teamColor,
            projectCount: this.projectCount
        };
    }

    public get dashboardPresenter(): DashboardPresenter.Interface {
        return this.dashboard;
    }

    public load = async (teamId: string): Promise<void> => {
        this.loading = true;
        this.error = null;
        this.previousTeamId = this.teamFilterService.selectedTeamId;
        this.teamFilterService.setSelectedTeamId(teamId);

        try {
            const detail = await this.teamsGateway.getDetail(teamId);
            runInAction(() => {
                this.teamName = detail.name;
                this.teamColor = detail.color;
                this.projectCount = detail.projects.length;
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load team";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public dispose = (): void => {
        this.teamFilterService.setSelectedTeamId(this.previousTeamId);
    };
}

export const TeamDetailPresenter = Abstraction.createImplementation({
    implementation: TeamDetailPresenterImpl,
    dependencies: [TeamsGateway, TeamFilterService, DashboardPresenter]
});
