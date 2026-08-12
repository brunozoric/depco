import { ChangelogsGateway as Abstraction } from "./abstractions/ChangelogsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    getChangelogStatsRoute,
    reResolveAllChangelogsRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute
} from "#shared/routes/index.js";

class ChangelogsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getStats(): Promise<Abstraction.Stats> {
        return this.httpClient.request(getChangelogStatsRoute, { params: {} });
    }

    public async reResolveAll(): Promise<Abstraction.ReResolveAllResult> {
        return this.httpClient.request(reResolveAllChangelogsRoute, { params: {} });
    }

    public async getChangelogs(
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> {
        const response = await this.httpClient.request(getChangelogsRoute, {
            params: { packageName },
            query: { from, to }
        });
        return { entries: response.items, resolving: response.resolving };
    }

    public async reResolveChangelogs(
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> {
        const response = await this.httpClient.request(reResolveChangelogsRoute, {
            params: { packageName },
            body: { from, to }
        });
        return { entries: response.items, resolving: response.resolving };
    }
}

export const ChangelogsGateway = Abstraction.createImplementation({
    implementation: ChangelogsGatewayImpl,
    dependencies: [HTTPClient]
});
