import { AppLogsGateway as Abstraction } from "./abstractions/AppLogsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

class AppLogsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(
        filters: Abstraction.Filters,
        limit?: number,
        offset?: number
    ): Promise<Abstraction.ListResponse> {
        const query = cleanQueryRecord({
            level: filters.level,
            source: filters.source,
            projectId: filters.projectId,
            from: filters.from,
            to: filters.to,
            limit: limit !== undefined ? String(limit) : undefined,
            offset: offset !== undefined ? String(offset) : undefined
        });

        const response = await this.httpClient.request(listLogsRoute, {
            params: {},
            query
        });
        return { items: response.items, total: response.total };
    }

    public async deleteFiltered(filters: Abstraction.Filters): Promise<number> {
        const body = cleanQueryRecord({
            level: filters.level,
            source: filters.source,
            projectId: filters.projectId,
            from: filters.from,
            to: filters.to
        });

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
