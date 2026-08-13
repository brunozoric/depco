import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    bulkScanProjectsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { ProjectsGateway } from "../abstractions/ProjectsGateway.js";
import { ProjectsGateway as ProjectsGatewayRegistration } from "../ProjectsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("ProjectsGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): ProjectsGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(ProjectsGatewayRegistration);

        return container.resolve(ProjectsGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("list() calls listProjectsRoute and returns the unwrapped items", async () => {
        const gateway = createGateway();
        const project = {
            id: "p1",
            name: "test-project",
            path: "/tmp/test-project",
            pmVersion: "4.1.0",
            addedAt: 1000,
            lastScannedAt: null,
            security: null,
            hasNodeModules: false
        };
        mockResult = { items: [project], total: 1 };

        const result = await gateway.list();

        expect(calls).toEqual([
            {
                route: listProjectsRoute,
                args: {
                    params: {},
                    query: {
                        page: undefined,
                        pageSize: undefined,
                        search: undefined,
                        teamId: undefined
                    }
                }
            }
        ]);
        expect(result).toEqual({ items: [{ ...project, teams: [] }], total: 1 });
    });

    it("get(id) calls getProjectRoute and returns the unwrapped item", async () => {
        const gateway = createGateway();
        const project = {
            id: "p1",
            name: "test-project",
            path: "/tmp/test-project",
            pmVersion: "4.1.0",
            addedAt: 1000,
            lastScannedAt: null,
            security: null,
            hasNodeModules: false
        };
        mockResult = { item: project };

        const result = await gateway.get("p1");

        expect(calls).toEqual([{ route: getProjectRoute, args: { params: { id: "p1" } } }]);
        expect(result).toEqual({ ...project, teams: [] });
    });

    it("create(path) calls createProjectRoute with the path body", async () => {
        const gateway = createGateway();
        const project = {
            id: "p2",
            name: "new-project",
            path: "/tmp/new-project",
            pmVersion: null,
            addedAt: 2000,
            lastScannedAt: null,
            security: null,
            hasNodeModules: false
        };
        mockResult = { item: project };

        const result = await gateway.create("/tmp/new-project");

        expect(calls).toEqual([
            {
                route: createProjectRoute,
                args: { params: {}, body: { path: "/tmp/new-project" } }
            }
        ]);
        expect(result).toEqual({ ...project, teams: [] });
    });

    it("remove(id) calls deleteProjectRoute", async () => {
        const gateway = createGateway();

        await gateway.remove("p1");

        expect(calls).toEqual([{ route: deleteProjectRoute, args: { params: { id: "p1" } } }]);
    });

    it("scan(id) calls scanProjectAsyncRoute without a force query param and returns the jobId", async () => {
        const gateway = createGateway();
        mockResult = { item: { jobId: "job-1" } };

        const result = await gateway.scan("p1");

        expect(calls).toEqual([
            {
                route: scanProjectAsyncRoute,
                args: { params: { id: "p1" }, query: undefined }
            }
        ]);
        expect(result).toEqual({ jobId: "job-1" });
    });

    it("scan(id, true) calls scanProjectAsyncRoute with force=true query", async () => {
        const gateway = createGateway();
        mockResult = { item: { jobId: "job-2" } };

        await gateway.scan("p1", true);

        expect(calls).toEqual([
            {
                route: scanProjectAsyncRoute,
                args: { params: { id: "p1" }, query: { force: "true" } }
            }
        ]);
    });

    it("getDependencies(id) calls getProjectDependenciesRoute and returns the unwrapped items", async () => {
        const gateway = createGateway();
        const dependency = {
            name: "left-pad",
            currentVersion: "1.0.0",
            latestInRange: "1.0.0",
            latestVersion: "1.2.0",
            type: "dependency",
            upgradeType: "minor",
            dependencyKind: "dependency",
            registryResolved: true
        };
        mockResult = { items: [dependency], total: 1 };

        const result = await gateway.getDependencies("p1");

        expect(calls[0]!.route).toBe(getProjectDependenciesRoute);
        expect(result).toEqual({ dependencies: [dependency], total: 1, lastScannedAt: null });
    });

    it("getSecurity(id) calls getProjectSecurityRoute and returns the unwrapped item", async () => {
        const gateway = createGateway();
        const security = {
            passes: true,
            checks: {
                npmPreapprovedPackages: true,
                npmMinimalAgeGate: true,
                enableScripts: false,
                approvedGitRepositories: true
            }
        };
        mockResult = { item: security };

        const result = await gateway.getSecurity("p1");

        expect(calls).toEqual([{ route: getProjectSecurityRoute, args: { params: { id: "p1" } } }]);
        expect(result).toEqual(security);
    });

    it("checkSecurity(id) calls checkProjectSecurityRoute and returns the unwrapped item", async () => {
        const gateway = createGateway();
        const security = {
            passes: false,
            checks: {
                npmPreapprovedPackages: false,
                npmMinimalAgeGate: true,
                enableScripts: true,
                approvedGitRepositories: true
            }
        };
        mockResult = { item: security };

        const result = await gateway.checkSecurity("p1");

        expect(calls).toEqual([
            { route: checkProjectSecurityRoute, args: { params: { id: "p1" } } }
        ]);
        expect(result).toEqual(security);
    });

    it("bulkScan(projectIds) calls bulkScanProjectsRoute with the project ids and no force flag", async () => {
        const gateway = createGateway();
        mockResult = { enqueuedCount: 2, skippedCount: 0 };

        const result = await gateway.bulkScan(["p1", "p2"]);

        expect(calls).toEqual([
            {
                route: bulkScanProjectsRoute,
                args: { params: {}, body: { projectIds: ["p1", "p2"], force: undefined } }
            }
        ]);
        expect(result).toEqual({ enqueuedCount: 2, skippedCount: 0 });
    });

    it("bulkScan(projectIds, true) calls bulkScanProjectsRoute with force=true", async () => {
        const gateway = createGateway();
        mockResult = { enqueuedCount: 1, skippedCount: 1 };

        const result = await gateway.bulkScan(["p1"], true);

        expect(calls).toEqual([
            {
                route: bulkScanProjectsRoute,
                args: { params: {}, body: { projectIds: ["p1"], force: true } }
            }
        ]);
        expect(result).toEqual({ enqueuedCount: 1, skippedCount: 1 });
    });
});
