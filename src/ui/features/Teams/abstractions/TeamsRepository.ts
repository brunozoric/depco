import { createAbstraction } from "#shared/index.js";
import type { TeamsGateway } from "./TeamsGateway.js";

export interface ITeamsRepository {
    getTeams(): TeamsGateway.WithStats[];
    setTeams(teams: TeamsGateway.WithStats[]): void;
}

export const TeamsRepository = createAbstraction<ITeamsRepository>("Ui/TeamsRepository");

export namespace TeamsRepository {
    export type Interface = ITeamsRepository;
}
