import { DependencyGraphGateway as Abstraction } from "./abstractions/DependencyGraphGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    getDependencyGraphRoute,
    refreshDependencyGraphRoute,
    getDependencyGraphStatsRoute,
    searchDependencyPackagesRoute
} from "#shared/routes/index.js";

class DependencyGraphGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getGraph(projectId: string): Promise<Abstraction.Graph> {
        const response = await this.httpClient.request(getDependencyGraphRoute, {
            params: { projectId },
            query: {}
        });

        if ("edges" in response) {
            return response;
        }

        throw new Error("Unexpected response shape for dependency graph");
    }

    public async findPaths(params: Abstraction.FindPathsParams): Promise<Abstraction.Path[]> {
        const response = await this.httpClient.request(getDependencyGraphRoute, {
            params: { projectId: params.projectId },
            query: { package: params.packageName }
        });

        if ("paths" in response) {
            return response.paths;
        }

        throw new Error("Unexpected response shape for dependency graph paths");
    }

    public async searchPackages(params: Abstraction.SearchPackagesParams): Promise<string[]> {
        const response = await this.httpClient.request(searchDependencyPackagesRoute, {
            params: { projectId: params.projectId },
            query: {
                query: params.query,
                ...(params.limit !== undefined ? { limit: params.limit } : {})
            }
        });

        return response.packages;
    }

    public async getStats(projectId: string): Promise<Abstraction.Stats> {
        return this.httpClient.request(getDependencyGraphStatsRoute, { params: { projectId } });
    }

    public async refresh(projectId: string): Promise<Abstraction.RefreshResult> {
        return this.httpClient.request(refreshDependencyGraphRoute, { params: { projectId } });
    }
}

export const DependencyGraphGateway = Abstraction.createImplementation({
    implementation: DependencyGraphGatewayImpl,
    dependencies: [HTTPClient]
});
