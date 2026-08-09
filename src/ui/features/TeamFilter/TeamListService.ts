import { makeAutoObservable } from "mobx";
import { TeamListService as Abstraction } from "./abstractions/TeamListService.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { listTeamsRoute } from "#shared/routes/index.js";

class TeamListServiceImpl implements Abstraction.Interface {
    private teams: Abstraction.TeamListItem[] = [];

    public constructor(private readonly httpClient: HTTPClient.Interface) {
        makeAutoObservable(this);
    }

    public async loadTeams(): Promise<void> {
        const response = await this.httpClient.request(listTeamsRoute, { params: {} });
        this.teams = response.items.map(team => ({
            id: team.id,
            name: team.name,
            color: team.color
        }));
    }

    public getTeams(): Abstraction.TeamListItem[] {
        return this.teams;
    }
}

export const TeamListService = Abstraction.createImplementation({
    implementation: TeamListServiceImpl,
    dependencies: [HTTPClient]
});
