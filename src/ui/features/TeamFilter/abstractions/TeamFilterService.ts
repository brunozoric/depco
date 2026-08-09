import { createAbstraction } from "#shared/index.js";

export interface ITeamFilterService {
    get selectedTeamId(): string | null;
    setSelectedTeamId(teamId: string | null): void;
}

export const TeamFilterService = createAbstraction<ITeamFilterService>("Ui/TeamFilterService");

export namespace TeamFilterService {
    export type Interface = ITeamFilterService;
}
