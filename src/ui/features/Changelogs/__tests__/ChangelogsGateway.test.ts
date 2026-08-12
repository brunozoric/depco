import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { getChangelogStatsRoute, reResolveAllChangelogsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { ChangelogsGateway } from "../abstractions/ChangelogsGateway.js";
import { ChangelogsGateway as ChangelogsGatewayRegistration } from "../ChangelogsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("ChangelogsGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): ChangelogsGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(ChangelogsGatewayRegistration);

        return container.resolve(ChangelogsGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("getStats calls getChangelogStatsRoute with empty params", async () => {
        mockResult = { total: 10, resolved: 6, failed: 2, pending: 2, byResolver: { github: 6 } };
        const gateway = createGateway();

        const result = await gateway.getStats();

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(getChangelogStatsRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual({
            total: 10,
            resolved: 6,
            failed: 2,
            pending: 2,
            byResolver: { github: 6 }
        });
    });

    it("reResolveAll calls reResolveAllChangelogsRoute with empty params", async () => {
        mockResult = { packageCount: 4 };
        const gateway = createGateway();

        const result = await gateway.reResolveAll();

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(reResolveAllChangelogsRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual({ packageCount: 4 });
    });
});
