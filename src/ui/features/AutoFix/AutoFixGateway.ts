import { AutoFixGateway as Abstraction } from "./abstractions/AutoFixGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    getAutoFixSettingsRoute,
    updateAutoFixSettingsRoute,
    listAutoFixPullRequestsRoute,
    getProjectAutoFixPullRequestsRoute,
    generateAutoFixPrRoute,
    deleteAutoFixPullRequestRoute
} from "#shared/routes/index.js";
import { cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

class AutoFixGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getSettings(projectId: string): Promise<Abstraction.Settings> {
        return this.httpClient.request(getAutoFixSettingsRoute, { params: { projectId } });
    }

    public async updateSettings(
        projectId: string,
        input: Abstraction.UpdateSettingsInput
    ): Promise<Abstraction.Settings> {
        return this.httpClient.request(updateAutoFixSettingsRoute, {
            params: { projectId },
            body: input
        });
    }

    public async listPullRequests(
        filters?: Abstraction.PullRequestListFilters
    ): Promise<Abstraction.PullRequestListResponse> {
        return this.httpClient.request(listAutoFixPullRequestsRoute, {
            params: {},
            query: cleanQueryRecord({
                projectId: filters?.projectId,
                status: filters?.status
            })
        });
    }

    public async getProjectPullRequests(
        projectId: string,
        filters?: Abstraction.ProjectPullRequestListFilters
    ): Promise<Abstraction.PullRequestListResponse> {
        return this.httpClient.request(getProjectAutoFixPullRequestsRoute, {
            params: { projectId },
            query: cleanQueryRecord({ status: filters?.status })
        });
    }

    public async generate(projectId: string): Promise<Abstraction.GenerateResult> {
        return this.httpClient.request(generateAutoFixPrRoute, { params: { projectId } });
    }

    public async deletePullRequest(id: string): Promise<Abstraction.DeletePullRequestResult> {
        return this.httpClient.request(deleteAutoFixPullRequestRoute, { params: { id } });
    }
}

export const AutoFixGateway = Abstraction.createImplementation({
    implementation: AutoFixGatewayImpl,
    dependencies: [HTTPClient]
});
