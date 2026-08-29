import { createAbstraction } from "#shared/index.js";

export interface ITeamWithStats {
    id: string;
    name: string;
    color: string;
    createdAt: number;
    projectCount: number;
    vulnerabilityCount: number;
    compliantPercent: number;
    averageHealthScore: number;
}

export interface ITeamProjectSummary {
    id: string;
    name: string;
    path: string;
}

export interface ITeamDetail {
    id: string;
    name: string;
    color: string;
    createdAt: number;
    projects: ITeamProjectSummary[];
}

export interface ITeamItem {
    id: string;
    name: string;
    color: string;
}

export interface ICreateTeamInput {
    name: string;
    color: string;
}

export interface IUpdateTeamInput {
    name?: string;
    color?: string;
}

export interface ITeamListResponse {
    items: ITeamWithStats[];
    total: number;
}

export interface IProjectTeamsResponse {
    items: ITeamItem[];
    total: number;
}

export interface ISetTeamProjectsInput {
    teamId: string;
    projectIds: string[];
}

export interface ITeamsGateway {
    list(): Promise<ITeamListResponse>;
    getDetail(id: string): Promise<ITeamDetail>;
    create(input: ICreateTeamInput): Promise<ITeamWithStats>;
    update(id: string, input: IUpdateTeamInput): Promise<ITeamWithStats>;
    remove(id: string): Promise<void>;
    getProjectTeams(projectId: string): Promise<IProjectTeamsResponse>;
    setProjectTeams(projectId: string, teamIds: string[]): Promise<void>;
    setTeamProjects(input: ISetTeamProjectsInput): Promise<void>;
}

export const TeamsGateway = createAbstraction<ITeamsGateway>("Ui/TeamsGateway");

export namespace TeamsGateway {
    export type Interface = ITeamsGateway;
    export type WithStats = ITeamWithStats;
    export type ProjectSummary = ITeamProjectSummary;
    export type Detail = ITeamDetail;
    export type Item = ITeamItem;
    export type CreateInput = ICreateTeamInput;
    export type UpdateInput = IUpdateTeamInput;
    export type ListResponse = ITeamListResponse;
    export type ProjectTeamsResponse = IProjectTeamsResponse;
    export type SetTeamProjectsInput = ISetTeamProjectsInput;
}
