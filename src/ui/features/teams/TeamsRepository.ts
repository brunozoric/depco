import { TeamsRepository as Abstraction } from "./abstractions/TeamsRepository.js";
import type { TeamsGateway } from "./abstractions/TeamsGateway.js";

class TeamsRepositoryImpl implements Abstraction.Interface {
    private teams: TeamsGateway.WithStats[] = [];

    public getTeams(): TeamsGateway.WithStats[] {
        return this.teams;
    }

    public setTeams(teams: TeamsGateway.WithStats[]): void {
        this.teams = teams;
    }
}

export const TeamsRepository = Abstraction.createImplementation({
    implementation: TeamsRepositoryImpl,
    dependencies: []
});
