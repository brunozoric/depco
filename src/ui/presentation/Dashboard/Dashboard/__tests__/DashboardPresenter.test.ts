import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    dashboardHealthRoute,
    dashboardTrendRoute,
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    getVulnerabilitySummaryRoute,
    dashboardVulnerabilityTrendRoute,
    getLicenseSummaryRoute,
    listAutoFixPullRequestsRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute,
    dashboardScoreDetailRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { DashboardFeature } from "../../../../features/Dashboard/feature.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { DashboardUseCasesFeature } from "../../useCases/feature.js";
import { DashboardPresenter as DashboardPresenterAbstraction } from "../abstractions/DashboardPresenter.js";
import { DashboardPresenter as DashboardPresenterRegistration } from "../DashboardPresenter.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";
import { TeamFilterFeature } from "../../../../features/TeamFilter/feature.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface MockEventBridge {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
}

describe("DashboardPresenter", () => {
    let calls: RecordedCall[];
    let healthResult: DashboardGateway.HealthResponse;
    let trendResult: DashboardGateway.TrendResponse;
    let activityResult: DashboardGateway.ActivityResponse;
    let stalenessResult: DashboardGateway.StalenessResponse;
    let securityResult: DashboardGateway.SecurityResponse;
    let vulnerabilitySummaryResult: DashboardGateway.VulnerabilitySummaryResponse;
    let vulnerabilityTrendResult: DashboardGateway.VulnerabilityTrendResponse;
    let licenseSummaryResult: DashboardGateway.LicenseComplianceSummary;
    let autoFixPullRequestsResult: { items: unknown[]; total: number };
    let stalenessTrendResult: DashboardGateway.StalenessTrendResponse;
    let licenseTrendResult: DashboardGateway.LicenseTrendResponse;
    let autoFixTrendResult: DashboardGateway.AutoFixTrendResponse;
    let scoreDetailResult: DashboardGateway.ScoreDetailResponse;
    let eventBridgeMock: MockEventBridge;
    let requestError: unknown;

    function createPresenter(): DashboardPresenterAbstraction.Interface {
        const container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (requestError !== null) {
                    throw requestError;
                }
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
                    case dashboardVulnerabilityTrendRoute:
                        return vulnerabilityTrendResult as T;
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
                    case dashboardScoreDetailRoute:
                        return scoreDetailResult as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        eventBridgeMock = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn()
        };
        container.registerInstance(
            EventBridge,
            eventBridgeMock as unknown as EventBridge.Interface
        );

        DashboardFeature.register(container);
        DashboardUseCasesFeature.register(container);
        TeamFilterFeature.register(container);
        container.register(DashboardPresenterRegistration);

        return container.resolve(DashboardPresenterAbstraction);
    }

    beforeEach(() => {
        calls = [];
        requestError = null;
        healthResult = {
            summary: { totalProjects: 2, averageScore: 75, worstProject: null },
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
        vulnerabilityTrendResult = { points: [] };
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
        scoreDetailResult = { outdatedPackages: [], vulnerabilities: [] };
    });

    it("default vm state before load", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            error: null,
            trendRange: "30d",
            summary: null,
            projects: [],
            trendData: [],
            activity: [],
            staleness: [],
            security: [],
            vulnerabilitySummary: null,
            vulnerabilityTrend: [],
            vulnerabilityTrendRange: "30d",
            licenseCompliance: null,
            openAutoFixPrCount: 0,
            stalenessTrend: [],
            licenseTrend: [],
            autoFixTrend: [],
            scoreModalProjectId: null,
            scoreDetailLoading: false,
            scoreDetail: null
        });
    });

    it("load sets loading to true then false", async () => {
        const presenter = createPresenter();
        const promise = presenter.load();

        expect(presenter.vm.loading).toBe(true);

        await promise;

        expect(presenter.vm.loading).toBe(false);
    });

    it("load calls the use case and populates vm from the repository", async () => {
        healthResult = {
            summary: { totalProjects: 1, averageScore: 90, worstProject: null },
            projects: [
                {
                    projectId: "p1",
                    projectName: "Alpha",
                    score: 90,
                    scoreDelta: null,
                    totalPackages: 10,
                    upToDate: 10,
                    patchOutdated: 0,
                    minorOutdated: 0,
                    majorOutdated: 0,
                    lastScannedAt: 1000,
                    vulnerabilityCritical: 0,
                    vulnerabilityHigh: 0,
                    vulnerabilityModerate: 0,
                    vulnerabilityLow: 0
                }
            ]
        };

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.summary).toEqual(healthResult.summary);
        expect(presenter.vm.projects).toEqual(healthResult.projects);
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
            dashboardAutoFixTrendRoute,
            dashboardVulnerabilityTrendRoute
        ]);
    });

    it("includes sparkline trend data from the repository in vm after load", async () => {
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
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.stalenessTrend).toEqual(stalenessTrendResult.points);
        expect(presenter.vm.licenseTrend).toEqual(licenseTrendResult.points);
        expect(presenter.vm.autoFixTrend).toEqual(autoFixTrendResult.points);
    });

    it("includes openAutoFixPrCount from the repository in vm after load", async () => {
        autoFixPullRequestsResult = { items: [{ id: "pr-1" }], total: 1 };
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.openAutoFixPrCount).toBe(1);
    });

    it("load sets the error message when the use case rejects with an Error", async () => {
        requestError = new Error("network failure");
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.error).toBe("network failure");
        expect(presenter.vm.loading).toBe(false);
    });

    it("load sets a fallback error message when the use case rejects with a non-Error", async () => {
        requestError = "boom";
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.error).toBe("Failed to load dashboard");
        expect(presenter.vm.loading).toBe(false);
    });

    it("setTrendRange updates trendRange and triggers a reload", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setTrendRange("90d");

        expect(presenter.vm.trendRange).toBe("90d");

        await new Promise(resolve => setTimeout(resolve, 0));

        const trendCalls = calls.filter(c => c.route === dashboardTrendRoute);
        expect(trendCalls.length).toBeGreaterThanOrEqual(1);
        expect(trendCalls[0]!.args).toEqual(
            expect.objectContaining({ query: expect.objectContaining({ range: "90d" }) })
        );
    });

    it("includes vulnerabilityTrend from repository in vm after load", async () => {
        vulnerabilityTrendResult = {
            points: [{ date: "2026-07-01", critical: 1, high: 2, moderate: 0, low: 3 }]
        };
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.vulnerabilityTrend).toEqual(vulnerabilityTrendResult.points);
    });

    it("defaults vulnerabilityTrendRange to 30d", () => {
        const presenter = createPresenter();

        expect(presenter.vm.vulnerabilityTrendRange).toBe("30d");
    });

    it("setVulnerabilityTrendRange updates vulnerabilityTrendRange and reloads only the vulnerability trend", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setVulnerabilityTrendRange("7d");

        expect(presenter.vm.vulnerabilityTrendRange).toBe("7d");

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls.map(c => c.route)).toEqual([dashboardVulnerabilityTrendRoute]);
        expect(calls[0]!.args).toEqual(
            expect.objectContaining({ query: expect.objectContaining({ days: "7" }) })
        );
    });

    it("subscribes to scan:complete and job:status on construction", () => {
        createPresenter();

        const registeredTypes = eventBridgeMock.on.mock.calls.map((c: unknown[]) => c[0]);
        expect(registeredTypes).toContain("scan:complete");
        expect(registeredTypes).toContain("job:status");
    });

    it("WS scan:complete triggers a health refresh", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        const handler = eventBridgeMock.on.mock.calls.find(
            (c: unknown[]) => c[0] === "scan:complete"
        )![1];
        handler({ projectId: "p1", warning: null });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls.map(c => c.route)).toEqual([dashboardHealthRoute, dashboardStalenessRoute]);
    });

    it("WS job:status triggers an activity refresh", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        const handler = eventBridgeMock.on.mock.calls.find(
            (c: unknown[]) => c[0] === "job:status"
        )![1];
        handler({
            jobId: "j1",
            referenceId: "p1",
            referenceType: "project",
            type: "scan",
            status: "completed"
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls.map(c => c.route)).toEqual([dashboardActivityRoute]);
    });

    it("openScoreModal sets the project id, sets loading, then populates scoreDetail", async () => {
        scoreDetailResult = {
            outdatedPackages: [
                {
                    name: "left-pad",
                    currentVersion: "1.0.0",
                    latestVersion: "1.1.0",
                    upgradeType: "minor"
                }
            ],
            vulnerabilities: [
                {
                    packageName: "left-pad",
                    severity: "high",
                    title: "Some vulnerability",
                    fixVersion: "1.1.0",
                    penalty: 5
                }
            ]
        };
        const presenter = createPresenter();

        presenter.openScoreModal("p1");

        expect(presenter.vm.scoreModalProjectId).toBe("p1");
        expect(presenter.vm.scoreDetailLoading).toBe(true);
        expect(presenter.vm.scoreDetail).toBeNull();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(presenter.vm.scoreDetailLoading).toBe(false);
        expect(presenter.vm.scoreDetail).toEqual(scoreDetailResult);
        expect(calls.map(c => c.route)).toEqual([dashboardScoreDetailRoute]);
        expect(calls[0]!.args).toEqual(expect.objectContaining({ params: { projectId: "p1" } }));
    });

    it("openScoreModal clears loading without setting scoreDetail when the request fails", async () => {
        requestError = new Error("boom");
        const presenter = createPresenter();

        presenter.openScoreModal("p1");
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(presenter.vm.scoreDetailLoading).toBe(false);
        expect(presenter.vm.scoreDetail).toBeNull();
    });

    it("closeScoreModal resets modal state", async () => {
        const presenter = createPresenter();

        presenter.openScoreModal("p1");
        await new Promise(resolve => setTimeout(resolve, 0));

        presenter.closeScoreModal();

        expect(presenter.vm.scoreModalProjectId).toBeNull();
        expect(presenter.vm.scoreDetailLoading).toBe(false);
        expect(presenter.vm.scoreDetail).toBeNull();
    });

    it("dispose unsubscribes WS listeners", () => {
        const presenter = createPresenter();

        presenter.dispose();

        expect(eventBridgeMock.off).toHaveBeenCalledTimes(2);
        const offTypes = eventBridgeMock.off.mock.calls.map((c: unknown[]) => c[0]);
        expect(offTypes).toContain("scan:complete");
        expect(offTypes).toContain("job:status");
    });
});
