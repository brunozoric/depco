import { ChangelogsGateway as Abstraction } from "./abstractions/ChangelogsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { getChangelogStatsRoute, reResolveAllChangelogsRoute } from "#shared/routes/index.js";

class ChangelogsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getStats(): Promise<Abstraction.Stats> {
        return this.httpClient.request(getChangelogStatsRoute, { params: {} });
    }

    public async reResolveAll(): Promise<Abstraction.ReResolveAllResult> {
        return this.httpClient.request(reResolveAllChangelogsRoute, { params: {} });
    }
}

export const ChangelogsGateway = Abstraction.createImplementation({
    implementation: ChangelogsGatewayImpl,
    dependencies: [HTTPClient]
});
