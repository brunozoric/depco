import { AppLogsGateway as Abstraction } from "./abstractions/AppLogsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";

class AppLogsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(
        filters: Abstraction.Filters,
        limit?: number,
        offset?: number
    ): Promise<Abstraction.ListResponse> {
        const query: Record<string, string> = {};
        if (filters.level) {
            query["level"] = filters.level;
        }
        if (filters.source) {
            query["source"] = filters.source;
        }
        if (filters.projectId) {
            query["projectId"] = filters.projectId;
        }
        if (filters.from) {
            query["from"] = filters.from;
        }
        if (filters.to) {
            query["to"] = filters.to;
        }
        if (limit !== undefined) {
            query["limit"] = String(limit);
        }
        if (offset !== undefined) {
            query["offset"] = String(offset);
        }

        const response = await this.httpClient.request(listLogsRoute, {
            params: {},
            query
        });
        return { items: response.items, total: response.total };
    }

    public async deleteFiltered(filters: Abstraction.Filters): Promise<number> {
        const body: Record<string, string> = {};
        if (filters.level) {
            body["level"] = filters.level;
        }
        if (filters.source) {
            body["source"] = filters.source;
        }
        if (filters.projectId) {
            body["projectId"] = filters.projectId;
        }
        if (filters.from) {
            body["from"] = filters.from;
        }
        if (filters.to) {
            body["to"] = filters.to;
        }

        const response = await this.httpClient.request(deleteLogsRoute, {
            params: {},
            body
        });
        return response.deleted;
    }
}

export const AppLogsGateway = Abstraction.createImplementation({
    implementation: AppLogsGatewayImpl,
    dependencies: [HTTPClient]
});
