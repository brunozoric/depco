import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    dashboardHealthRoute,
    dashboardTrendRoute,
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    dashboardVulnerabilityTrendRoute,
    getLicenseSummaryRoute,
    listAutoFixPullRequestsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { DashboardGateway } from "../abstractions/DashboardGateway.js";
import { DashboardGateway as DashboardGatewayRegistration } from "../DashboardGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("DashboardGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): DashboardGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(DashboardGatewayRegistration);

        return container.resolve(DashboardGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("getHealth()", () => {
        it("should call dashboardHealthRoute and return the response", async () => {
            mockResult = {
                summary: { totalProjects: 2, averageScore: 80, worstProject: null },
                projects: []
            };

            const gateway = createGateway();
            const result = await gateway.getHealth();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardHealthRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getTrend()", () => {
        it("should call dashboardTrendRoute with the range query param and return the response", async () => {
            mockResult = { items: [] };

            const gateway = createGateway();
            const result = await gateway.getTrend({ range: "30d" });

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardTrendRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: { range: "30d" } });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getActivity()", () => {
        it("should call dashboardActivityRoute and return the items", async () => {
            mockResult = { items: [{ id: "job-1" }] };

            const gateway = createGateway();
            const result = await gateway.getActivity();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardActivityRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getStaleness()", () => {
        it("should call dashboardStalenessRoute and return the items", async () => {
            mockResult = { items: [{ projectId: "p1" }] };

            const gateway = createGateway();
            const result = await gateway.getStaleness();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardStalenessRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getSecurity()", () => {
        it("should call dashboardSecurityRoute and return the items", async () => {
            mockResult = { items: [{ projectId: "p1" }] };

            const gateway = createGateway();
            const result = await gateway.getSecurity();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardSecurityRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getVulnerabilityTrend()", () => {
        it("should call dashboardVulnerabilityTrendRoute without a query when no days given", async () => {
            mockResult = { points: [] };

            const gateway = createGateway();
            const result = await gateway.getVulnerabilityTrend();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardVulnerabilityTrendRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });

        it("should call dashboardVulnerabilityTrendRoute with the days query param", async () => {
            mockResult = {
                points: [{ date: "2026-07-01", critical: 1, high: 2, moderate: 0, low: 0 }]
            };

            const gateway = createGateway();
            const result = await gateway.getVulnerabilityTrend({ days: 30 });

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(dashboardVulnerabilityTrendRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: { days: "30" } });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getLicenseSummary()", () => {
        it("should call getLicenseSummaryRoute and return the response", async () => {
            mockResult = {
                totalPackages: 10,
                compliantPercent: 90,
                riskTierCounts: {
                    permissive: 8,
                    "weak-copyleft": 1,
                    copyleft: 0,
                    proprietary: 1,
                    unknown: 0
                },
                violationCounts: { warn: 1, deny: 0 }
            };

            const gateway = createGateway();
            const result = await gateway.getLicenseSummary();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(getLicenseSummaryRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual(mockResult);
        });
    });

    describe("getOpenAutoFixPrCount()", () => {
        it("should call listAutoFixPullRequestsRoute with a created-status filter and return the total", async () => {
            mockResult = { items: [{ id: "pr-1" }, { id: "pr-2" }], total: 2 };

            const gateway = createGateway();
            const result = await gateway.getOpenAutoFixPrCount();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(listAutoFixPullRequestsRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: { status: "created" } });
            expect(result).toBe(2);
        });
    });
});
