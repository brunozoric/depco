import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listVulnerabilitiesRoute,
    bulkVulnerabilitiesRoute,
    bulkRescanVulnerabilitiesRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { VulnerabilitiesGateway } from "../abstractions/VulnerabilitiesGateway.js";
import { VulnerabilitiesGateway as VulnerabilitiesGatewayRegistration } from "../VulnerabilitiesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("VulnerabilitiesGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): VulnerabilitiesGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(VulnerabilitiesGatewayRegistration);

        return container.resolve(VulnerabilitiesGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("bulk methods", () => {
        it("bulkAction calls bulkVulnerabilitiesRoute with correct body", async () => {
            mockResult = { updatedCount: 3 };
            const gateway = createGateway();

            const result = await gateway.bulkAction({
                ids: ["id1", "id2", "id3"],
                action: "dismiss"
            });

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(bulkVulnerabilitiesRoute);
            expect(calls[0]!.args).toEqual({
                params: {},
                body: { ids: ["id1", "id2", "id3"], action: "dismiss" }
            });
            expect(result.updatedCount).toBe(3);
        });

        it("bulkAction includes snoozeDays for snooze action", async () => {
            mockResult = { updatedCount: 1 };
            const gateway = createGateway();

            await gateway.bulkAction({ ids: ["id1"], action: "snooze", snoozeDays: 30 });

            expect(calls[0]!.args).toEqual({
                params: {},
                body: { ids: ["id1"], action: "snooze", snoozeDays: 30 }
            });
        });

        it("bulkRescan calls bulkRescanVulnerabilitiesRoute", async () => {
            mockResult = { projectsQueued: 2 };
            const gateway = createGateway();

            const result = await gateway.bulkRescan(["id1", "id2"]);

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(bulkRescanVulnerabilitiesRoute);
            expect(calls[0]!.args).toEqual({ params: {}, body: { ids: ["id1", "id2"] } });
            expect(result.projectsQueued).toBe(2);
        });

        it("getExportUrl builds correct URL with filters", () => {
            const gateway = createGateway();

            const url = gateway.getExportUrl({
                filters: { severity: "critical", projectIds: ["p1", "p2"] },
                format: "csv"
            });

            expect(url).toContain("format=csv");
            expect(url).toContain("severity=critical");
            expect(url).toContain("projectIds=p1%2Cp2");
        });

        it("getExportUrl includes ids when provided", () => {
            const gateway = createGateway();

            const url = gateway.getExportUrl({ filters: {}, format: "json", ids: ["id1", "id2"] });

            expect(url).toContain("format=json");
            expect(url).toContain("ids=id1%2Cid2");
        });

        it("list passes projectIds and includeDismissed", async () => {
            mockResult = { items: [], total: 0 };
            const gateway = createGateway();

            await gateway.list({ projectIds: ["p1"], includeDismissed: true });

            expect(calls[0]!.route).toBe(listVulnerabilitiesRoute);
            const query = (calls[0]!.args as { query: Record<string, string> }).query;
            expect(query["projectIds"]).toBe("p1");
            expect(query["includeDismissed"]).toBe("true");
        });
    });
});
