import { makeAutoObservable, runInAction } from "mobx";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";
import type { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import type { TeamListService } from "../../../features/TeamFilter/abstractions/TeamListService.js";

interface ITeamsManagerDependencies {
    teamsGateway: TeamsGateway.Interface;
    teamListService: TeamListService.Interface;
    getProjectId: () => string | null;
}

export class TeamsManager {
    public projectTeamIds: string[] = [];

    private readonly teamsGateway: TeamsGateway.Interface;
    private readonly teamListService: TeamListService.Interface;
    private readonly getProjectId: () => string | null;

    public constructor(dependencies: ITeamsManagerDependencies) {
        this.teamsGateway = dependencies.teamsGateway;
        this.teamListService = dependencies.teamListService;
        this.getProjectId = dependencies.getProjectId;

        makeAutoObservable(this);
    }

    public get availableTeams(): ProjectDetailPresenter.TeamOption[] {
        return this.teamListService.getTeams();
    }

    public loadProjectTeams = async (projectId: string): Promise<void> => {
        try {
            const response = await this.teamsGateway.getProjectTeams(projectId);
            runInAction(() => {
                this.projectTeamIds = response.items.map(team => team.id);
            });
        } catch {
            // Project teams fetch failure should not break the page
        }
    };

    public loadAvailableTeams = async (): Promise<void> => {
        if (this.teamListService.getTeams().length === 0) {
            await this.teamListService.loadTeams();
        }
    };

    public setProjectTeams = async (teamIds: string[]): Promise<void> => {
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        await this.teamsGateway.setProjectTeams(projectId, teamIds);
        await this.loadProjectTeams(projectId);
    };
}
