import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listScanSchedulesRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute,
    getScanScheduleDefaultRoute,
    upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { ScanSchedulesGateway } from "../abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesGateway as ScanSchedulesGatewayRegistration } from "../ScanSchedulesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("ScanSchedulesGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): ScanSchedulesGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(ScanSchedulesGatewayRegistration);

        return container.resolve(ScanSchedulesGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("list() calls listScanSchedulesRoute and returns items + globalDefault", async () => {
        const gateway = createGateway();
        const item = {
            projectId: "p1",
            projectName: "test-project",
            interval: "24h",
            source: "default" as const,
            lastRunAt: null,
            nextRunAt: null
        };
        mockResult = { items: [item], globalDefault: "24h" };

        const result = await gateway.list();

        expect(calls).toEqual([{ route: listScanSchedulesRoute, args: { params: {} } }]);
        expect(result).toEqual({ items: [item], globalDefault: "24h" });
    });

    it("upsert(projectId, interval) calls upsertScanScheduleRoute and returns the unwrapped item", async () => {
        const gateway = createGateway();
        const row = {
            id: "s1",
            projectId: "p1",
            interval: "6h",
            lastRunAt: null,
            nextRunAt: null,
            enabled: true,
            createdAt: 1000,
            updatedAt: 1000
        };
        mockResult = { item: row };

        const result = await gateway.upsert("p1", "6h");

        expect(calls).toEqual([
            {
                route: upsertScanScheduleRoute,
                args: { params: { projectId: "p1" }, body: { interval: "6h" } }
            }
        ]);
        expect(result).toEqual(row);
    });

    it("remove(projectId) calls deleteScanScheduleRoute and returns nothing", async () => {
        const gateway = createGateway();
        mockResult = undefined;

        const result = await gateway.remove("p1");

        expect(calls).toEqual([
            { route: deleteScanScheduleRoute, args: { params: { projectId: "p1" } } }
        ]);
        expect(result).toBeUndefined();
    });

    it("getDefault() calls getScanScheduleDefaultRoute and returns the interval", async () => {
        const gateway = createGateway();
        mockResult = { item: { interval: "24h" } };

        const result = await gateway.getDefault();

        expect(calls).toEqual([{ route: getScanScheduleDefaultRoute, args: { params: {} } }]);
        expect(result).toBe("24h");
    });

    it("setDefault(interval) calls upsertScanScheduleDefaultRoute and returns the interval", async () => {
        const gateway = createGateway();
        mockResult = { item: { interval: "6h" } };

        const result = await gateway.setDefault("6h");

        expect(calls).toEqual([
            {
                route: upsertScanScheduleDefaultRoute,
                args: { params: {}, body: { interval: "6h" } }
            }
        ]);
        expect(result).toBe("6h");
    });
});
