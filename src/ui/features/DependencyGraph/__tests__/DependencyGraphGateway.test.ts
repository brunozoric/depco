import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    getDependencyGraphRoute,
    refreshDependencyGraphRoute,
    getDependencyGraphStatsRoute,
    searchDependencyPackagesRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { DependencyGraphGateway } from "../abstractions/DependencyGraphGateway.js";
import { DependencyGraphGateway as DependencyGraphGatewayRegistration } from "../DependencyGraphGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("DependencyGraphGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): DependencyGraphGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(DependencyGraphGatewayRegistration);

        return container.resolve(DependencyGraphGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("getGraph(projectId) calls getDependencyGraphRoute with an empty query and returns the graph", async () => {
        const gateway = createGateway();
        const graph = {
            edges: [
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    dependencyType: "prod",
                    depth: 0
                }
            ],
            rootPackages: ["lodash"],
            totalPackages: 1,
            maxDepth: 0,
            edgeCount: 1
        };
        mockResult = graph;

        const result = await gateway.getGraph("project-1");

        expect(calls).toEqual([
            {
                route: getDependencyGraphRoute,
                args: { params: { projectId: "project-1" }, query: {} }
            }
        ]);
        expect(result).toEqual(graph);
    });

    it("findPaths({ projectId, packageName }) calls getDependencyGraphRoute with the package query and returns the paths", async () => {
        const gateway = createGateway();
        const paths = [
            { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
        ];
        mockResult = { paths };

        const result = await gateway.findPaths({ projectId: "project-1", packageName: "lodash" });

        expect(calls).toEqual([
            {
                route: getDependencyGraphRoute,
                args: { params: { projectId: "project-1" }, query: { package: "lodash" } }
            }
        ]);
        expect(result).toEqual(paths);
    });

    it("searchPackages({ projectId, query, limit }) calls searchDependencyPackagesRoute and returns the packages", async () => {
        const gateway = createGateway();
        const packages = ["lodash", "lodash.merge"];
        mockResult = { packages };

        const result = await gateway.searchPackages({
            projectId: "project-1",
            query: "lod",
            limit: 10
        });

        expect(calls).toEqual([
            {
                route: searchDependencyPackagesRoute,
                args: { params: { projectId: "project-1" }, query: { query: "lod", limit: 10 } }
            }
        ]);
        expect(result).toEqual(packages);
    });

    it("searchPackages({ projectId, query }) without limit omits limit from the query instead of sending 'undefined'", async () => {
        const gateway = createGateway();
        const packages = ["lodash", "lodash.merge"];
        mockResult = { packages };

        const result = await gateway.searchPackages({
            projectId: "project-1",
            query: "lod"
        });

        expect(calls).toEqual([
            {
                route: searchDependencyPackagesRoute,
                args: { params: { projectId: "project-1" }, query: { query: "lod" } }
            }
        ]);
        expect(calls[0]?.args).toMatchObject({ query: { query: "lod" } });
        expect(
            Object.prototype.hasOwnProperty.call(
                (calls[0]?.args as { query: Record<string, unknown> }).query,
                "limit"
            )
        ).toBe(false);
        expect(result).toEqual(packages);
    });

    it("getStats(projectId) calls getDependencyGraphStatsRoute and returns the stats", async () => {
        const gateway = createGateway();
        const stats = { totalPackages: 10, maxDepth: 3, rootCount: 2, edgeCount: 15 };
        mockResult = stats;

        const result = await gateway.getStats("project-1");

        expect(calls).toEqual([
            { route: getDependencyGraphStatsRoute, args: { params: { projectId: "project-1" } } }
        ]);
        expect(result).toEqual(stats);
    });

    it("refresh(projectId) calls refreshDependencyGraphRoute and returns the edge count", async () => {
        const gateway = createGateway();
        mockResult = { edgeCount: 42 };

        const result = await gateway.refresh("project-1");

        expect(calls).toEqual([
            { route: refreshDependencyGraphRoute, args: { params: { projectId: "project-1" } } }
        ]);
        expect(result).toEqual({ edgeCount: 42 });
    });
});
