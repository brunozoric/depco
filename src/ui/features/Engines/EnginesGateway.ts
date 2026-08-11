import { EnginesGateway as Abstraction } from "./abstractions/EnginesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    getProjectEngineChecksRoute,
    getEngineSummaryRoute,
    scanProjectEnginesRoute,
    listNodeReleasesRoute
} from "#shared/routes/index.js";

class EnginesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getByProject(projectId: string): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(getProjectEngineChecksRoute, {
            params: { projectId }
        });
    }

    public async getSummary(): Promise<Abstraction.SummaryData> {
        return this.httpClient.request(getEngineSummaryRoute, {
            params: {}
        });
    }

    public async scan(projectId: string): Promise<Abstraction.ScanResult> {
        return this.httpClient.request(scanProjectEnginesRoute, {
            params: { projectId }
        });
    }

    public async getReleases(): Promise<Abstraction.NodeReleaseListResponse> {
        return this.httpClient.request(listNodeReleasesRoute, {
            params: {}
        });
    }
}

export const EnginesGateway = Abstraction.createImplementation({
    implementation: EnginesGatewayImpl,
    dependencies: [HTTPClient]
});
