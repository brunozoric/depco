import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { TeamsGateway } from "../../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamFilterService } from "../../../../features/TeamFilter/abstractions/TeamFilterService.js";
import { DashboardPresenter } from "../../../Dashboard/Dashboard/abstractions/DashboardPresenter.js";
import { TeamDetailPresenter } from "../abstractions/TeamDetailPresenter.js";
import { TeamDetailPresenter as TeamDetailPresenterRegistration } from "../TeamDetailPresenter.js";

describe("TeamDetailPresenter", () => {
    let mockGateway: TeamsGateway.Interface;
    let mockFilterService: TeamFilterService.Interface;
    let mockDashboardPresenter: DashboardPresenter.Interface;

    function createPresenter(): TeamDetailPresenter.Interface {
        const container = createContainer();
        container.registerInstance(TeamsGateway, mockGateway);
        container.registerInstance(TeamFilterService, mockFilterService);
        container.registerInstance(DashboardPresenter, mockDashboardPresenter);
        container.register(TeamDetailPresenterRegistration);
        return container.resolve(TeamDetailPresenter);
    }

    beforeEach(() => {
        mockGateway = {
            list: vi.fn(),
            getDetail: vi.fn(async () => ({
                id: "team-1",
                name: "Frontend",
                color: "#ff0000",
                createdAt: Date.now(),
                projects: [
                    { id: "p1", name: "App", path: "/app" },
                    { id: "p2", name: "Lib", path: "/lib" }
                ]
            })),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
            getProjectTeams: vi.fn(),
            setProjectTeams: vi.fn(),
            setTeamProjects: vi.fn()
        };

        mockFilterService = {
            get selectedTeamId() {
                return null;
            },
            setSelectedTeamId: vi.fn()
        };

        mockDashboardPresenter = {
            get vm() {
                return {
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
                };
            },
            load: vi.fn(),
            setTrendRange: vi.fn(),
            setVulnerabilityTrendRange: vi.fn(),
            openScoreModal: vi.fn(),
            closeScoreModal: vi.fn(),
            dispose: vi.fn()
        };
    });

    it("loads team detail and populates vm", async () => {
        const presenter = createPresenter();
        await presenter.load("team-1");

        expect(mockGateway.getDetail).toHaveBeenCalledWith("team-1");
        expect(presenter.vm.teamName).toBe("Frontend");
        expect(presenter.vm.teamColor).toBe("#ff0000");
        expect(presenter.vm.projectCount).toBe(2);
        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBeNull();
    });

    it("sets team filter on load", async () => {
        const presenter = createPresenter();
        await presenter.load("team-1");

        expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("team-1");
    });

    it("saves previous team id before overwriting", async () => {
        let currentId: string | null = "previous-team";
        mockFilterService = {
            get selectedTeamId() {
                return currentId;
            },
            setSelectedTeamId: vi.fn(id => {
                currentId = id;
            })
        };

        const presenter = createPresenter();
        await presenter.load("team-1");

        expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("team-1");

        presenter.dispose();
        expect(mockFilterService.setSelectedTeamId).toHaveBeenCalledWith("previous-team");
    });

    it("restores previous team id on dispose", async () => {
        const presenter = createPresenter();
        await presenter.load("team-1");
        presenter.dispose();

        expect(mockFilterService.setSelectedTeamId).toHaveBeenLastCalledWith(null);
    });

    it("sets vm.error on gateway failure", async () => {
        mockGateway.getDetail = vi.fn(async () => {
            throw new Error("Network error");
        });

        const presenter = createPresenter();
        await presenter.load("team-1");

        expect(presenter.vm.error).toBe("Network error");
        expect(presenter.vm.loading).toBe(false);
    });

    it("exposes dashboardPresenter", () => {
        const presenter = createPresenter();
        const dashboard = presenter.dashboardPresenter;
        expect(dashboard).toBeDefined();
        expect(typeof dashboard.load).toBe("function");
        expect(typeof dashboard.dispose).toBe("function");
        expect(typeof dashboard.setTrendRange).toBe("function");
    });

    it("sets loading true during load", async () => {
        let loadingDuringFetch = false;
        mockGateway.getDetail = vi.fn(async () => {
            loadingDuringFetch = presenter.vm.loading;
            return {
                id: "team-1",
                name: "Frontend",
                color: "#ff0000",
                createdAt: Date.now(),
                projects: []
            };
        });

        const presenter = createPresenter();
        const promise = presenter.load("team-1");
        expect(presenter.vm.loading).toBe(true);
        await promise;
        expect(loadingDuringFetch).toBe(true);
        expect(presenter.vm.loading).toBe(false);
    });
});
