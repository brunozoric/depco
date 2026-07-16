import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    dashboardHealthRoute,
    dashboardTrendRoute,
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    getVulnerabilitySummaryRoute,
    getLicenseSummaryRoute,
    listAutoFixPullRequestsRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { DashboardFeature } from "../../../../features/dashboard/feature.js";
import { DashboardRepository } from "../../../../features/dashboard/abstractions/DashboardRepository.js";
import { LoadDashboardUseCase } from "../abstractions/LoadDashboardUseCase.js";
import { LoadDashboardUseCase as LoadDashboardUseCaseRegistration } from "../LoadDashboardUseCase.js";
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    dashboardRepository: DashboardRepository.Interface;
    loadDashboardUseCase: LoadDashboardUseCase.Interface;
}

describe("LoadDashboardUseCase", () => {
    let calls: RecordedCall[];
    let healthResult: DashboardGateway.HealthResponse;
    let trendResult: DashboardGateway.TrendResponse;
    let activityResult: DashboardGateway.ActivityResponse;
    let stalenessResult: DashboardGateway.StalenessResponse;
    let securityResult: DashboardGateway.SecurityResponse;
    let vulnerabilitySummaryResult: DashboardGateway.VulnerabilitySummaryResponse;
    let licenseSummaryResult: DashboardGateway.LicenseComplianceSummary;
    let autoFixPullRequestsResult: { items: unknown[]; total: number };
    let stalenessTrendResult: DashboardGateway.StalenessTrendResponse;
    let licenseTrendResult: DashboardGateway.LicenseTrendResponse;
    let autoFixTrendResult: DashboardGateway.AutoFixTrendResponse;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case dashboardHealthRoute:
                        return healthResult as T;
                    case dashboardTrendRoute:
                        return trendResult as T;
                    case dashboardActivityRoute:
                        return activityResult as T;
                    case dashboardStalenessRoute:
                        return stalenessResult as T;
                    case dashboardSecurityRoute:
                        return securityResult as T;
                    case getVulnerabilitySummaryRoute:
                        return vulnerabilitySummaryResult as T;
                    case getLicenseSummaryRoute:
                        return licenseSummaryResult as T;
                    case listAutoFixPullRequestsRoute:
                        return autoFixPullRequestsResult as T;
                    case dashboardStalenessTrendRoute:
                        return stalenessTrendResult as T;
                    case dashboardLicenseTrendRoute:
                        return licenseTrendResult as T;
                    case dashboardAutoFixTrendRoute:
                        return autoFixTrendResult as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        DashboardFeature.register(container);
        container.register(LoadDashboardUseCaseRegistration);

        return {
            dashboardRepository: container.resolve(DashboardRepository),
            loadDashboardUseCase: container.resolve(LoadDashboardUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        healthResult = {
            summary: { totalProjects: 1, averageScore: 80, worstProject: null },
            projects: []
        };
        trendResult = { items: [] };
        activityResult = { items: [] };
        stalenessResult = { items: [] };
        securityResult = { items: [] };
        vulnerabilitySummaryResult = {
            totalVulnerabilities: 0,
            counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
            transitiveCount: 0,
            directCount: 0,
            projectSummaries: []
        };
        licenseSummaryResult = {
            totalPackages: 0,
            compliantPercent: 100,
            riskTierCounts: {
                permissive: 0,
                "weak-copyleft": 0,
                copyleft: 0,
                proprietary: 0,
                unknown: 0
            },
            violationCounts: { warn: 0, deny: 0 }
        };
        autoFixPullRequestsResult = { items: [], total: 0 };
        stalenessTrendResult = { points: [] };
        licenseTrendResult = { points: [] };
        autoFixTrendResult = { points: [] };
    });

    it("execute calls all 11 gateway methods and stores results in repository", async () => {
        const context = createContext();

        await context.loadDashboardUseCase.execute({ trendRange: "30d" });

        expect(calls.map(c => c.route)).toEqual([
            dashboardHealthRoute,
            dashboardTrendRoute,
            dashboardActivityRoute,
            dashboardStalenessRoute,
            dashboardSecurityRoute,
            getVulnerabilitySummaryRoute,
            getLicenseSummaryRoute,
            listAutoFixPullRequestsRoute,
            dashboardStalenessTrendRoute,
            dashboardLicenseTrendRoute,
            dashboardAutoFixTrendRoute
        ]);
        expect(context.dashboardRepository.getHealthResponse()).toEqual(healthResult);
        expect(context.dashboardRepository.getTrendResponse()).toEqual(trendResult);
        expect(context.dashboardRepository.getActivity()).toEqual([]);
        expect(context.dashboardRepository.getStaleness()).toEqual([]);
        expect(context.dashboardRepository.getSecurity()).toEqual([]);
        expect(context.dashboardRepository.getVulnerabilitySummary()).toEqual(
            vulnerabilitySummaryResult
        );
        expect(context.dashboardRepository.getLicenseComplianceSummary()).toEqual(
            licenseSummaryResult
        );
        expect(context.dashboardRepository.getOpenAutoFixPrCount()).toBe(0);
        expect(context.dashboardRepository.getStalenessTrend()).toEqual([]);
        expect(context.dashboardRepository.getLicenseTrend()).toEqual([]);
        expect(context.dashboardRepository.getAutoFixTrend()).toEqual([]);
    });

    it("execute stores the sparkline trend points from the gateway responses", async () => {
        stalenessTrendResult = {
            points: [
                {
                    date: "2026-08-01",
                    patchOutdated: 1,
                    minorOutdated: 2,
                    majorOutdated: 3,
                    totalPackages: 10
                }
            ]
        };
        licenseTrendResult = {
            points: [
                {
                    date: "2026-08-01",
                    compliantCount: 8,
                    deniedCount: 1,
                    warnedCount: 1,
                    totalPackages: 10
                }
            ]
        };
        autoFixTrendResult = {
            points: [
                { date: "2026-08-01", pending: 1, created: 2, merged: 3, closed: 0, failed: 0 }
            ]
        };
        const context = createContext();

        await context.loadDashboardUseCase.execute({ trendRange: "30d" });

        expect(context.dashboardRepository.getStalenessTrend()).toEqual(
            stalenessTrendResult.points
        );
        expect(context.dashboardRepository.getLicenseTrend()).toEqual(licenseTrendResult.points);
        expect(context.dashboardRepository.getAutoFixTrend()).toEqual(autoFixTrendResult.points);

        const stalenessTrendCall = calls.find(c => c.route === dashboardStalenessTrendRoute);
        const licenseTrendCall = calls.find(c => c.route === dashboardLicenseTrendRoute);
        const autoFixTrendCall = calls.find(c => c.route === dashboardAutoFixTrendRoute);
        expect(stalenessTrendCall?.args).toEqual({ params: {}, query: { days: "7" } });
        expect(licenseTrendCall?.args).toEqual({ params: {}, query: { days: "7" } });
        expect(autoFixTrendCall?.args).toEqual({ params: {}, query: { days: "7" } });
    });

    it("execute stores the open auto-fix PR count from the gateway response total", async () => {
        autoFixPullRequestsResult = { items: [{ id: "pr-1" }, { id: "pr-2" }], total: 2 };
        const context = createContext();

        await context.loadDashboardUseCase.execute({ trendRange: "30d" });

        expect(context.dashboardRepository.getOpenAutoFixPrCount()).toBe(2);
    });

    it("execute passes trendRange through to the gateway", async () => {
        const context = createContext();

        await context.loadDashboardUseCase.execute({ trendRange: "90d" });

        const trendCall = calls.find(c => c.route === dashboardTrendRoute);
        expect(trendCall?.args).toEqual({ params: {}, query: { range: "90d" } });
    });

    it("refreshHealth calls health + staleness and updates repository", async () => {
        const context = createContext();

        await context.loadDashboardUseCase.refreshHealth();

        expect(calls.map(c => c.route)).toEqual([dashboardHealthRoute, dashboardStalenessRoute]);
        expect(context.dashboardRepository.getHealthResponse()).toEqual(healthResult);
        expect(context.dashboardRepository.getStaleness()).toEqual([]);
    });

    it("refreshActivity calls activity and updates repository", async () => {
        const context = createContext();

        await context.loadDashboardUseCase.refreshActivity();

        expect(calls.map(c => c.route)).toEqual([dashboardActivityRoute]);
        expect(context.dashboardRepository.getActivity()).toEqual([]);
    });
});
