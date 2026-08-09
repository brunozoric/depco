import { computed, makeAutoObservable, runInAction } from "mobx";
import { TeamsPresenter as Abstraction } from "./abstractions/TeamsPresenter.js";
import type { IProjectOption } from "./abstractions/TeamsPresenter.js";
import { LoadTeamsUseCase } from "../useCases/abstractions/LoadTeamsUseCase.js";
import { ManageTeamUseCase } from "../useCases/abstractions/ManageTeamUseCase.js";
import { TeamsRepository } from "../../../features/Teams/abstractions/TeamsRepository.js";
import { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";

const DEFAULT_TEAM_COLOR = "#228be6";

class TeamsPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private mutationError: string | null = null;
    private editingTeam: Abstraction.FormState | null = null;
    private deletingTeamId: string | null = null;
    private availableProjects: IProjectOption[] = [];

    public constructor(
        private readonly loadTeamsUseCase: LoadTeamsUseCase.Interface,
        private readonly manageTeamUseCase: ManageTeamUseCase.Interface,
        private readonly repository: TeamsRepository.Interface,
        private readonly teamsGateway: TeamsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            mutationError: this.mutationError,
            teams: this.repository.getTeams(),
            editingTeam: this.editingTeam,
            deletingTeamId: this.deletingTeamId,
            availableProjects: this.availableProjects
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await this.loadTeamsUseCase.execute();
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load teams";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public openCreateModal = (): void => {
        this.editingTeam = { id: null, name: "", color: DEFAULT_TEAM_COLOR, projectIds: [] };
        void this.loadAvailableProjects();
    };

    public openEditModal = (team: TeamsGateway.WithStats): void => {
        this.editingTeam = { id: team.id, name: team.name, color: team.color, projectIds: [] };
        void this.loadAvailableProjects();
        void this.loadTeamProjects(team.id);
    };

    private loadAvailableProjects = async (): Promise<void> => {
        try {
            if (this.projectsRepository.getProjects().length === 0) {
                await this.loadProjectsUseCase.execute();
            }
            runInAction(() => {
                this.availableProjects = this.projectsRepository.getProjects().map(project => ({
                    value: project.id,
                    label: project.name
                }));
            });
        } catch {
            // Projects list is best-effort; MultiSelect stays empty on failure
        }
    };

    private loadTeamProjects = async (teamId: string): Promise<void> => {
        try {
            const detail = await this.teamsGateway.getDetail(teamId);
            runInAction(() => {
                if (this.editingTeam?.id === teamId) {
                    this.editingTeam.projectIds = detail.projects.map(project => project.id);
                }
            });
        } catch {
            // Team detail is best-effort; projectIds stays empty on failure
        }
    };

    public closeModal = (): void => {
        this.editingTeam = null;
    };

    public setFormName = (name: string): void => {
        if (this.editingTeam) {
            this.editingTeam.name = name;
        }
    };

    public setFormColor = (color: string): void => {
        if (this.editingTeam) {
            this.editingTeam.color = color;
        }
    };

    public setFormProjects = (projectIds: string[]): void => {
        if (this.editingTeam) {
            this.editingTeam.projectIds = projectIds;
        }
    };

    public saveTeam = async (): Promise<void> => {
        const editingTeam = this.editingTeam;
        if (!editingTeam) {
            return;
        }
        this.mutationError = null;
        try {
            let teamId: string;
            if (editingTeam.id) {
                await this.manageTeamUseCase.update(editingTeam.id, {
                    name: editingTeam.name,
                    color: editingTeam.color
                });
                teamId = editingTeam.id;
            } else {
                const created = await this.manageTeamUseCase.create({
                    name: editingTeam.name,
                    color: editingTeam.color
                });
                teamId = created.id;
                runInAction(() => {
                    editingTeam.id = teamId;
                });
            }
            await this.teamsGateway.setTeamProjects({
                teamId,
                projectIds: editingTeam.projectIds
            });
            await this.loadTeamsUseCase.execute();
            runInAction(() => {
                this.editingTeam = null;
            });
        } catch (err) {
            runInAction(() => {
                this.mutationError = err instanceof Error ? err.message : "Failed to save team";
            });
        }
    };

    public confirmDelete = (id: string): void => {
        this.deletingTeamId = id;
    };

    public cancelDelete = (): void => {
        this.deletingTeamId = null;
    };

    public deleteTeam = async (): Promise<void> => {
        const id = this.deletingTeamId;
        if (!id) {
            return;
        }
        this.mutationError = null;
        try {
            await this.manageTeamUseCase.remove(id);
        } catch (err) {
            runInAction(() => {
                this.mutationError = err instanceof Error ? err.message : "Failed to delete team";
            });
        } finally {
            runInAction(() => {
                this.deletingTeamId = null;
            });
        }
    };
}

export const TeamsPresenter = Abstraction.createImplementation({
    implementation: TeamsPresenterImpl,
    dependencies: [
        LoadTeamsUseCase,
        ManageTeamUseCase,
        TeamsRepository,
        TeamsGateway,
        ProjectsRepository,
        LoadProjectsUseCase
    ]
});
