import { TeamsGateway as Abstraction } from "./abstractions/TeamsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    listTeamsRoute,
    createTeamRoute,
    updateTeamRoute,
    deleteTeamRoute,
    getTeamDetailRoute,
    getProjectTeamsRoute,
    setProjectTeamsRoute,
    setTeamProjectsRoute
} from "#shared/routes/index.js";

class TeamsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(listTeamsRoute, { params: {} });
    }

    public async getDetail(id: string): Promise<Abstraction.Detail> {
        const response = await this.httpClient.request(getTeamDetailRoute, { params: { id } });
        return response.item;
    }

    public async create(input: Abstraction.CreateInput): Promise<Abstraction.WithStats> {
        const response = await this.httpClient.request(createTeamRoute, {
            params: {},
            body: input
        });
        return response.item;
    }

    public async update(
        id: string,
        input: Abstraction.UpdateInput
    ): Promise<Abstraction.WithStats> {
        const response = await this.httpClient.request(updateTeamRoute, {
            params: { id },
            body: input
        });
        return response.item;
    }

    public async remove(id: string): Promise<void> {
        await this.httpClient.request(deleteTeamRoute, { params: { id } });
    }

    public async getProjectTeams(projectId: string): Promise<Abstraction.ProjectTeamsResponse> {
        return this.httpClient.request(getProjectTeamsRoute, { params: { id: projectId } });
    }

    public async setProjectTeams(projectId: string, teamIds: string[]): Promise<void> {
        await this.httpClient.request(setProjectTeamsRoute, {
            params: { id: projectId },
            body: { teamIds }
        });
    }

    public async setTeamProjects(input: { teamId: string; projectIds: string[] }): Promise<void> {
        await this.httpClient.request(setTeamProjectsRoute, {
            params: { id: input.teamId },
            body: { projectIds: input.projectIds }
        });
    }
}

export const TeamsGateway = Abstraction.createImplementation({
    implementation: TeamsGatewayImpl,
    dependencies: [HTTPClient]
});
