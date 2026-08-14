import { EnginesGateway as Abstraction } from "./abstractions/EnginesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    getProjectEngineChecksRoute,
    getProjectEngineStalenessRoute,
    getEngineSummaryRoute,
    scanProjectEnginesRoute,
    bulkScanEnginesRoute,
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
        const response = await this.httpClient.request(getEngineSummaryRoute, {
            params: {}
        });
        return response.item;
    }

    public async getStaleness(projectId: string): Promise<Abstraction.StalenessData> {
        const response = await this.httpClient.request(getProjectEngineStalenessRoute, {
            params: { projectId }
        });
        return response.item;
    }

    public async scan(projectId: string): Promise<Abstraction.ScanResult> {
        const response = await this.httpClient.request(scanProjectEnginesRoute, {
            params: { projectId },
            query: {}
        });
        return response.item;
    }

    public async bulkScanEngines(projectIds: string[]): Promise<Abstraction.BulkScanResult> {
        return this.httpClient.request(bulkScanEnginesRoute, {
            params: {},
            body: { projectIds }
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
