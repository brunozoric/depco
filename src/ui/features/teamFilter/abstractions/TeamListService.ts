import { createAbstraction } from "#shared/index.js";

export interface ITeamListItem {
    id: string;
    name: string;
    color: string;
}

export interface ITeamListService {
    loadTeams(): Promise<void>;
    getTeams(): ITeamListItem[];
}

export const TeamListService = createAbstraction<ITeamListService>("Ui/TeamListService");

export namespace TeamListService {
    export type Interface = ITeamListService;
    export type TeamListItem = ITeamListItem;
}
