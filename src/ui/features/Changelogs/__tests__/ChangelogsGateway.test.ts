import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    getChangelogStatsRoute,
    reResolveAllChangelogsRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute
} from "#shared/routes/index.js";
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

    it("getChangelogs() calls getChangelogsRoute and returns entries and resolving", async () => {
        const gateway = createGateway();
        const entries: ChangelogsGateway.ChangelogEntry[] = [
            { version: "2.0.0", content: "breaking changes", source: "github" }
        ];
        mockResult = { items: entries, total: 1, resolving: false };

        const result = await gateway.getChangelogs("left-pad", "1.0.0", "2.0.0");

        expect(calls).toEqual([
            {
                route: getChangelogsRoute,
                args: { params: { packageName: "left-pad" }, query: { from: "1.0.0", to: "2.0.0" } }
            }
        ]);
        expect(result).toEqual({ entries, resolving: false });
    });

    it("reResolveChangelogs() calls reResolveChangelogsRoute with body and returns entries and resolving", async () => {
        const gateway = createGateway();
        const entries: ChangelogsGateway.ChangelogEntry[] = [
            { version: "2.0.0", content: null, source: null }
        ];
        mockResult = { items: entries, total: 0, resolving: true };

        const result = await gateway.reResolveChangelogs("left-pad", "1.0.0", "2.0.0");

        expect(calls).toEqual([
            {
                route: reResolveChangelogsRoute,
                args: {
                    params: { packageName: "left-pad" },
                    body: { from: "1.0.0", to: "2.0.0" }
                }
            }
        ]);
        expect(result).toEqual({ entries, resolving: true });
    });
});
