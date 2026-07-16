import { makeAutoObservable } from "mobx";
import { TeamFilterService as Abstraction } from "./abstractions/TeamFilterService.js";
import { Cache } from "@webiny/stdlib";

const CACHE_KEY = "team-filter:selectedTeamId";

class TeamFilterServiceImpl implements Abstraction.Interface {
    private teamId: string | null = null;

    public constructor(private readonly cache: Cache.Interface) {
        makeAutoObservable(this);
        const result = this.cache.get<string>(CACHE_KEY);
        if (result.isOk() && result.value !== null) {
            this.teamId = result.value;
        }
    }

    public get selectedTeamId(): string | null {
        return this.teamId;
    }

    public setSelectedTeamId(teamId: string | null): void {
        this.teamId = teamId;
        if (teamId === null) {
            this.cache.remove(CACHE_KEY);
        } else {
            this.cache.set(CACHE_KEY, teamId);
        }
    }
}

export const TeamFilterService = Abstraction.createImplementation({
    implementation: TeamFilterServiceImpl,
    dependencies: [Cache]
});
