import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    getProjectEngineChecksRoute,
    getEngineSummaryRoute,
    scanProjectEnginesRoute,
    listNodeReleasesRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { EnginesGateway } from "../abstractions/EnginesGateway.js";
import { EnginesGateway as EnginesGatewayRegistration } from "../EnginesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("EnginesGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): EnginesGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(EnginesGatewayRegistration);

        return container.resolve(EnginesGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("getByProject calls getProjectEngineChecksRoute with projectId param", async () => {
        mockResult = { items: [], total: 0 };
        const gateway = createGateway();

        const result = await gateway.getByProject("project-1");

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(getProjectEngineChecksRoute);
        expect(calls[0]!.args).toEqual({ params: { projectId: "project-1" } });
        expect(result).toEqual({ items: [], total: 0 });
    });

    it("getSummary calls getEngineSummaryRoute with empty params", async () => {
        mockResult = { totalProjects: 0, counts: {}, projectSummaries: [] };
        const gateway = createGateway();

        const result = await gateway.getSummary();

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(getEngineSummaryRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual({ totalProjects: 0, counts: {}, projectSummaries: [] });
    });

    it("scan calls scanProjectEnginesRoute with projectId param", async () => {
        mockResult = {
            rootStatus: "current",
            rootEnginesNode: ">=20",
            findings: [],
            summary: { totalProjects: 1, counts: {}, projectSummaries: [] }
        };
        const gateway = createGateway();

        const result = await gateway.scan("project-1");

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(scanProjectEnginesRoute);
        expect(calls[0]!.args).toEqual({ params: { projectId: "project-1" } });
        expect(result.rootStatus).toBe("current");
    });

    it("getReleases calls listNodeReleasesRoute with empty params", async () => {
        mockResult = { items: [], total: 0 };
        const gateway = createGateway();

        const result = await gateway.getReleases();

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(listNodeReleasesRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual({ items: [], total: 0 });
    });
});
