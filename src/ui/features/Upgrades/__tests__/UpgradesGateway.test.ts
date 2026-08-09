import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    createUpgradeJobRoute,
    createTransientJobRoute,
    listJobsRoute,
    getJobRoute,
    updatePackageManagerRoute,
    getPackageManagerRoute,
    clearCacheRoute,
    clearPackageCacheRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { UpgradesGateway } from "../abstractions/UpgradesGateway.js";
import { UpgradesGateway as UpgradesGatewayRegistration } from "../UpgradesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("UpgradesGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): UpgradesGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(UpgradesGatewayRegistration);

        return container.resolve(UpgradesGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("startUpgrade() calls createUpgradeJobRoute with packages and refreshTransient", async () => {
        const gateway = createGateway();
        mockResult = { item: { jobId: "job-1" } };

        const result = await gateway.startUpgrade(
            "p1",
            [{ name: "left-pad", targetVersion: "2.0.0" }],
            true
        );

        expect(calls).toEqual([
            {
                route: createUpgradeJobRoute,
                args: {
                    params: { id: "p1" },
                    body: {
                        packages: [{ name: "left-pad", targetVersion: "2.0.0" }],
                        refreshTransient: true
                    }
                }
            }
        ]);
        expect(result).toEqual({ jobId: "job-1" });
    });

    it("startTransient() calls createTransientJobRoute", async () => {
        const gateway = createGateway();
        mockResult = { item: { jobId: "job-2" } };

        const result = await gateway.startTransient("p1");

        expect(calls).toEqual([{ route: createTransientJobRoute, args: { params: { id: "p1" } } }]);
        expect(result).toEqual({ jobId: "job-2" });
    });

    it("getJob(projectId, jobId) calls getJobRoute", async () => {
        const gateway = createGateway();
        const job = {
            id: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed",
            packages: "[]",
            logs: "done",
            startedAt: 1000,
            completedAt: 2000,
            warning: null,
            progress: null,
            progressLabel: null
        };
        mockResult = { item: job };

        const result = await gateway.getJob("p1", "job-1");

        expect(calls).toEqual([
            { route: getJobRoute, args: { params: { id: "p1", jobId: "job-1" } } }
        ]);
        expect(result).toEqual(job);
    });

    it("getJobs(projectId) calls listJobsRoute", async () => {
        const gateway = createGateway();
        const job = {
            id: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "transient",
            status: "pending",
            packages: null,
            logs: null,
            startedAt: null,
            completedAt: null,
            warning: null,
            progress: null,
            progressLabel: null
        };
        mockResult = { items: [job], total: 1 };

        const result = await gateway.getJobs("p1");

        expect(calls).toEqual([{ route: listJobsRoute, args: { params: { id: "p1" } } }]);
        expect(result).toEqual([job]);
    });

    it("updatePackageManager(projectId, version) calls updatePackageManagerRoute with the version", async () => {
        const gateway = createGateway();
        mockResult = { item: { jobId: "job-3" } };

        const result = await gateway.updatePackageManager("p1", "4.2.0");

        expect(calls).toEqual([
            {
                route: updatePackageManagerRoute,
                args: { params: { id: "p1" }, body: { version: "4.2.0" } }
            }
        ]);
        expect(result).toEqual({ jobId: "job-3" });
    });

    it("getPackageManagerInfo(projectId) calls getPackageManagerRoute", async () => {
        const gateway = createGateway();
        mockResult = { item: { version: "4.2.0" } };

        const result = await gateway.getPackageManagerInfo("p1");

        expect(calls).toEqual([{ route: getPackageManagerRoute, args: { params: { id: "p1" } } }]);
        expect(result).toEqual({ version: "4.2.0" });
    });

    it("clearCache() calls clearCacheRoute", async () => {
        const gateway = createGateway();
        mockResult = { success: true };

        await gateway.clearCache();

        expect(calls).toEqual([{ route: clearCacheRoute, args: { params: {} } }]);
    });

    it("clearCachePackage(name) calls clearPackageCacheRoute", async () => {
        const gateway = createGateway();
        mockResult = { success: true };

        await gateway.clearCachePackage("left-pad");

        expect(calls).toEqual([
            { route: clearPackageCacheRoute, args: { params: { packageName: "left-pad" } } }
        ]);
    });
});
