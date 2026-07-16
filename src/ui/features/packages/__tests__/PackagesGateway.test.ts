import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { PackagesGateway } from "../abstractions/PackagesGateway.js";
import { PackagesGateway as PackagesGatewayRegistration } from "../PackagesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("PackagesGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): PackagesGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(PackagesGatewayRegistration);

        return container.resolve(PackagesGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("list() with no filters calls listPackagesRoute with undefined query and returns items and total", async () => {
        const gateway = createGateway();
        const pkg: PackagesGateway.PackageListItem = {
            name: "left-pad",
            projects: [
                {
                    projectId: "p1",
                    projectName: "my-project",
                    currentVersion: "1.0.0",
                    latestVersion: "2.0.0",
                    upgradeType: "major"
                }
            ],
            changelogCount: 3,
            lastPublishedAt: 1000,
            dependencyKind: "dependency",
            registryResolved: true
        };
        mockResult = { items: [pkg], total: 1 };

        const result = await gateway.list();

        expect(calls).toEqual([
            { route: listPackagesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(result).toEqual({ items: [pkg], total: 1 });
    });

    it("list() with filters populates query parameters correctly", async () => {
        const gateway = createGateway();
        mockResult = { items: [], total: 0 };

        await gateway.list({
            search: "lodash",
            upgradeType: "major",
            dependencyKind: "transitive",
            projectId: "p1",
            sortBy: "name",
            sortOrder: "desc"
        });

        expect(calls).toEqual([
            {
                route: listPackagesRoute,
                args: {
                    params: {},
                    query: {
                        search: "lodash",
                        upgradeType: "major",
                        dependencyKind: "transitive",
                        projectId: "p1",
                        sortBy: "name",
                        sortOrder: "desc"
                    }
                }
            }
        ]);
    });

    it("list() with hasChangelog sets hasChangelog to 'true' in query", async () => {
        const gateway = createGateway();
        mockResult = { items: [], total: 0 };

        await gateway.list({ hasChangelog: true });

        expect(calls).toEqual([
            {
                route: listPackagesRoute,
                args: { params: {}, query: { hasChangelog: "true" } }
            }
        ]);
    });

    it("list() with page and pageSize stringifies them in query", async () => {
        const gateway = createGateway();
        mockResult = { items: [], total: 0 };

        await gateway.list({ page: 2, pageSize: 25 });

        expect(calls).toEqual([
            {
                route: listPackagesRoute,
                args: { params: {}, query: { page: "2", pageSize: "25" } }
            }
        ]);
    });

    it("rescanPackage() calls rescanPackageRoute with the package name", async () => {
        const gateway = createGateway();
        mockResult = { item: { updated: 1 } };

        await gateway.rescanPackage("left-pad");

        expect(calls).toEqual([
            { route: rescanPackageRoute, args: { params: { packageName: "left-pad" }, query: {} } }
        ]);
    });

    it("getChangelogs() calls getChangelogsRoute and returns entries and resolving", async () => {
        const gateway = createGateway();
        const entries: PackagesGateway.ChangelogEntry[] = [
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
        const entries: PackagesGateway.ChangelogEntry[] = [
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
