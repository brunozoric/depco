import { createAbstraction } from "#shared/index.js";
import type { TeamsGateway } from "../../../../features/teams/abstractions/TeamsGateway.js";

export interface IProjectOption {
    value: string;
    label: string;
}

export interface ITeamFormState {
    id: string | null;
    name: string;
    color: string;
    projectIds: string[];
}

export interface ITeamsViewModel {
    loading: boolean;
    error: string | null;
    mutationError: string | null;
    teams: TeamsGateway.WithStats[];
    editingTeam: ITeamFormState | null;
    deletingTeamId: string | null;
    availableProjects: IProjectOption[];
}

export interface ITeamsPresenter {
    get vm(): ITeamsViewModel;
    load(): Promise<void>;
    openCreateModal(): void;
    openEditModal(team: TeamsGateway.WithStats): void;
    closeModal(): void;
    setFormName(name: string): void;
    setFormColor(color: string): void;
    setFormProjects(projectIds: string[]): void;
    saveTeam(): Promise<void>;
    confirmDelete(id: string): void;
    cancelDelete(): void;
    deleteTeam(): Promise<void>;
}

export const TeamsPresenter = createAbstraction<ITeamsPresenter>("Ui/TeamsPresenter");

export namespace TeamsPresenter {
    export type Interface = ITeamsPresenter;
    export type ViewModel = ITeamsViewModel;
    export type FormState = ITeamFormState;
}
