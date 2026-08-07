import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    listProjectsRoute,
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    createUpgradeJobRoute,
    createTransientJobRoute,
    updatePackageManagerRoute,
    listScanSchedulesRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute,
    getProjectVulnerabilitiesRoute,
    getProjectLicensesRoute,
    getAutoFixSettingsRoute,
    updateAutoFixSettingsRoute,
    getProjectAutoFixPullRequestsRoute,
    generateAutoFixPrRoute,
    listTeamsRoute,
    getProjectTeamsRoute,
    setProjectTeamsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { ProjectsFeature } from "../../../../features/projects/feature.js";
import { UpgradesFeature } from "../../../../features/upgrades/feature.js";
import { ScanSchedulesFeature } from "../../../../features/scanSchedules/index.js";
import { VulnerabilitiesFeature } from "../../../../features/vulnerabilities/feature.js";
import { LicensesFeature } from "../../../../features/licenses/feature.js";
import { AutoFixFeature } from "../../../../features/autoFix/feature.js";
import { TeamsFeature } from "../../../../features/teams/feature.js";
import { TeamFilterFeature } from "../../../../features/teamFilter/feature.js";
import { SbomGateway as SbomGatewayAbstraction } from "../../../../features/sbom/abstractions/SbomGateway.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../useCases/LoadProjectsUseCase.js";
import { ScanProjectUseCase as ScanProjectUseCaseRegistration } from "../../useCases/ScanProjectUseCase.js";
import { CheckSecurityUseCase as CheckSecurityUseCaseRegistration } from "../../useCases/CheckSecurityUseCase.js";
import { UpgradePackagesUseCase as UpgradePackagesUseCaseRegistration } from "../../../upgrades/useCases/UpgradePackagesUseCase.js";
import { RefreshTransientUseCase as RefreshTransientUseCaseRegistration } from "../../../upgrades/useCases/RefreshTransientUseCase.js";
import { UpdatePackageManagerUseCase as UpdatePackageManagerUseCaseRegistration } from "../../../upgrades/useCases/UpdatePackageManagerUseCase.js";
import { LoadScanSchedulesUseCase as LoadScanSchedulesUseCaseRegistration } from "../../../scanSchedules/useCases/LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase as UpdateScanScheduleUseCaseRegistration } from "../../../scanSchedules/useCases/UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase as ResetScanScheduleUseCaseRegistration } from "../../../scanSchedules/useCases/ResetScanScheduleUseCase.js";
import { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter as ProjectDetailPresenterRegistration } from "../ProjectDetailPresenter.js";
import { UrlFilterService } from "../../../../features/urlFilter/abstractions/UrlFilterService.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

async function flushMicrotasks(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

function createFakeEventBridge(): {
    bridge: EventBridge.Interface;
    emit: <K extends EventBridge.EventName>(event: K, data: EventBridge.EventMap[K]) => void;
    listenerCount: (event: EventBridge.EventName) => number;
} {
    const handlers = new Map<string, Set<(data: unknown) => void>>();

    const bridge: EventBridge.Interface = {
        on: (event, handler) => {
            let set = handlers.get(event);
            if (!set) {
                set = new Set();
                handlers.set(event, set);
            }
            set.add(handler as (data: unknown) => void);
        },
        off: (event, handler) => {
            handlers.get(event)?.delete(handler as (data: unknown) => void);
        },
        emit: (event, data) => {
            for (const handler of handlers.get(event) ?? []) {
                handler(data);
            }
        }
    };

    function listenerCount(event: EventBridge.EventName): number {
        return handlers.get(event)?.size ?? 0;
    }

    return { bridge, emit: bridge.emit, listenerCount };
}

describe("ProjectDetailPresenter", () => {
    let calls: RecordedCall[];
    let projectsListResult: unknown;
    let dependenciesResult: unknown;
    let securityResult: unknown;
    let upgradeResult: unknown;
    let transientResult: unknown;
    let packageManagerResult: unknown;
    let scanJobId: string;
    let scanSchedulesItems: unknown;
    let scanScheduleGlobalDefault: string;
    let vulnerabilitiesResult: unknown;
    let licensesResult: unknown;
    let autoFixSettingsResult: Record<string, unknown>;
    let autoFixPullRequestsResult: unknown[];
    let autoFixGenerateJobId: string;
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;
    let sbomExportCalls: Array<{ projectId: string; format: string }>;
    let sbomExportResult: { blob: Blob; filename: string };
    let sbomExportShouldFail: Error | null;
    let teamsListResult: unknown[];
    let projectTeamsResult: Array<{ id: string; name: string; color: string }>;

    function createPresenter(): ProjectDetailPresenter.Interface {
        const container: Container = createContainer();

        // Real HTTPClient feature is registered first; the mock instance below
        // takes precedence over it (instance registrations win over class
        // registrations in @webiny/di), so only the HTTP boundary is mocked.
        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case listProjectsRoute:
                        return {
                            items: projectsListResult,
                            total: (projectsListResult as []).length
                        } as T;
                    case getProjectSecurityRoute:
                    case checkProjectSecurityRoute:
                        return { item: securityResult } as T;
                    case getProjectDependenciesRoute:
                        return {
                            items: dependenciesResult,
                            total: (dependenciesResult as []).length
                        } as T;
                    case scanProjectAsyncRoute:
                        return { item: { jobId: scanJobId } } as T;
                    case createUpgradeJobRoute:
                        return { item: upgradeResult } as T;
                    case createTransientJobRoute:
                        return { item: transientResult } as T;
                    case updatePackageManagerRoute:
                        return { item: packageManagerResult } as T;
                    case listScanSchedulesRoute:
                        return {
                            items: scanSchedulesItems,
                            globalDefault: scanScheduleGlobalDefault
                        } as T;
                    case upsertScanScheduleRoute: {
                        const upsertArgs = args as {
                            params: { projectId: string };
                            body: { interval: string };
                        };
                        return {
                            item: {
                                id: "sched-1",
                                projectId: upsertArgs.params.projectId,
                                interval: upsertArgs.body.interval,
                                lastRunAt: null,
                                nextRunAt: null,
                                enabled: true,
                                createdAt: 0,
                                updatedAt: 0
                            }
                        } as T;
                    }
                    case deleteScanScheduleRoute:
                        return undefined as T;
                    case getProjectVulnerabilitiesRoute:
                        return {
                            items: vulnerabilitiesResult,
                            total: (vulnerabilitiesResult as []).length
                        } as T;
                    case getProjectLicensesRoute:
                        return {
                            items: licensesResult,
                            total: (licensesResult as []).length
                        } as T;
                    case getAutoFixSettingsRoute:
                        return autoFixSettingsResult as T;
                    case updateAutoFixSettingsRoute: {
                        const updateArgs = args as {
                            params: { projectId: string };
                            body: Record<string, unknown>;
                        };
                        autoFixSettingsResult = {
                            ...autoFixSettingsResult,
                            ...updateArgs.body
                        };
                        return autoFixSettingsResult as T;
                    }
                    case getProjectAutoFixPullRequestsRoute:
                        return {
                            items: autoFixPullRequestsResult,
                            total: autoFixPullRequestsResult.length
                        } as T;
                    case generateAutoFixPrRoute:
                        return { jobId: autoFixGenerateJobId } as T;
                    case listTeamsRoute:
                        return {
                            items: teamsListResult,
                            total: teamsListResult.length
                        } as T;
                    case getProjectTeamsRoute:
                        return {
                            items: projectTeamsResult,
                            total: projectTeamsResult.length
                        } as T;
                    case setProjectTeamsRoute: {
                        const setTeamsArgs = args as { body: { teamIds: string[] } };
                        projectTeamsResult = setTeamsArgs.body.teamIds.map(
                            teamId =>
                                projectTeamsResult.find(team => team.id === teamId) ?? {
                                    id: teamId,
                                    name: teamId,
                                    color: "#000000"
                                }
                        );
                        return undefined as T;
                    }
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        container.registerInstance(SbomGatewayAbstraction, {
            exportProject: async (projectId: string, format: string) => {
                sbomExportCalls.push({ projectId, format });
                if (sbomExportShouldFail) {
                    throw sbomExportShouldFail;
                }
                return sbomExportResult;
            },
            exportAll: async () => {
                throw new Error("exportAll is not exercised by ProjectDetailPresenter");
            }
        });

        ProjectsFeature.register(container);
        UpgradesFeature.register(container);
        ScanSchedulesFeature.register(container);
        VulnerabilitiesFeature.register(container);
        LicensesFeature.register(container);
        AutoFixFeature.register(container);
        TeamsFeature.register(container);
        TeamFilterFeature.register(container);
        container.registerInstance(UrlFilterService, {
            read: () => ({}),
            update: () => {},
            onChange: () => () => {}
        });
        container.register(LoadProjectsUseCaseRegistration);
        container.register(ScanProjectUseCaseRegistration);
        container.register(CheckSecurityUseCaseRegistration);
        container.register(UpgradePackagesUseCaseRegistration);
        container.register(RefreshTransientUseCaseRegistration);
        container.register(UpdatePackageManagerUseCaseRegistration);
        container.register(LoadScanSchedulesUseCaseRegistration);
        container.register(UpdateScanScheduleUseCaseRegistration);
        container.register(ResetScanScheduleUseCaseRegistration);
        container.register(ProjectDetailPresenterRegistration);

        return container.resolve(ProjectDetailPresenter);
    }

    async function loadAndFlush(
        presenter: ProjectDetailPresenter.Interface,
        projectId: string
    ): Promise<void> {
        await presenter.load(projectId);
        await flushMicrotasks();
    }

    beforeEach(() => {
        calls = [];
        projectsListResult = [];
        dependenciesResult = [];
        securityResult = {
            passes: true,
            checks: {
                npmPreapprovedPackages: true,
                npmMinimalAgeGate: true,
                enableScripts: true,
                approvedGitRepositories: true
            }
        };
        upgradeResult = { jobId: "job-1" };
        transientResult = { jobId: "job-2" };
        packageManagerResult = { jobId: "job-3" };
        scanJobId = "scan-job-1";
        scanSchedulesItems = [];
        scanScheduleGlobalDefault = "disabled";
        vulnerabilitiesResult = [];
        licensesResult = [];
        autoFixSettingsResult = {
            id: "af-1",
            projectId: "p1",
            enabled: false,
            upgradeTypes: ["patch", "minor"],
            groupingStrategy: "single",
            branchPrefix: "auto-fix/",
            createdAt: 0,
            updatedAt: 0
        };
        autoFixPullRequestsResult = [];
        autoFixGenerateJobId = "af-job-1";
        sbomExportCalls = [];
        sbomExportResult = { blob: new Blob(["sbom-content"]), filename: "sbom.json" };
        sbomExportShouldFail = null;
        teamsListResult = [];
        projectTeamsResult = [];
    });

    it("starts with an empty, idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            scanning: false,
            scanProgress: null,
            scanError: null,
            scanWarning: null,
            project: null,
            security: null,
            dependencies: [],
            upgradeFilter: "all",
            totalDependencyCount: 0,
            search: "",
            page: 1,
            pageSize: 25,
            totalPages: 0,
            canUpgrade: false,
            selectedCount: 0,
            packageManagerUpdateVersion: "",
            schedule: null,
            autoFixSettings: null,
            autoFixPullRequests: [],
            autoFixRunning: false,
            exportingSbom: false,
            sbomExportError: null,
            projectTeamIds: [],
            availableTeams: [],
            changelogState: null
        });
    });

    it("registers WebSocket listeners for scan events on construction", () => {
        createPresenter();

        expect(fakeEventBridge.listenerCount("scan:progress")).toBe(1);
        expect(fakeEventBridge.listenerCount("scan:complete")).toBe(1);
        expect(fakeEventBridge.listenerCount("scan:failed")).toBe(1);
        expect(fakeEventBridge.listenerCount("transitive-resolve:complete")).toBe(1);
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = createPresenter();

        const pending = presenter.load("p1");
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("loads project, security, and persisted dependencies without auto-scanning", async () => {
        const presenter = createPresenter();
        projectsListResult = [
            {
                id: "p1",
                name: "test-project",
                path: "/tmp/test-project",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: null
            }
        ];
        dependenciesResult = [
            {
                name: "left-pad",
                currentVersion: "1.0.0",
                latestInRange: "1.2.0",
                latestVersion: "2.0.0",
                type: "dependency",
                upgradeType: "minor"
            },
            {
                name: "chalk",
                currentVersion: "4.0.0",
                latestInRange: "4.1.0",
                latestVersion: "5.0.0",
                type: "devDependency",
                upgradeType: "major"
            }
        ];

        await loadAndFlush(presenter, "p1");

        expect(presenter.vm.project).toEqual({
            id: "p1",
            name: "test-project",
            path: "/tmp/test-project",
            pmVersion: "4.1.0",
            packageManager: "yarn"
        });
        expect(presenter.vm.security).toEqual(securityResult);
        expect(presenter.vm.dependencies).toHaveLength(2);
        expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
        expect(presenter.vm.canUpgrade).toBe(false);
        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.scanning).toBe(false);
        expect(calls.some(c => c.route === scanProjectAsyncRoute)).toBe(false);
    });

    describe("scan", () => {
        it("enqueues an async scan job and sets scanning true", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            calls = [];

            const pending = presenter.scan(true);
            expect(presenter.vm.scanning).toBe(true);
            await pending;

            expect(calls).toEqual([
                {
                    route: scanProjectAsyncRoute,
                    args: { params: { id: "p1" }, query: { force: "true" } }
                }
            ]);
            expect(presenter.vm.scanning).toBe(true);
        });

        it("updates scanProgress on scan:progress events for the current project", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();

            fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 3,
                total: 10
            });

            expect(presenter.vm.scanProgress).toEqual({
                packageName: "lodash",
                current: 3,
                total: 10
            });
        });

        it("ignores scan:progress events for a different project", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();

            fakeEventBridge.emit("scan:progress", {
                projectId: "other-project",
                packageName: "lodash",
                current: 3,
                total: 10
            });

            expect(presenter.vm.scanProgress).toBeNull();
        });

        it("reloads dependencies and security, and clears scanning on scan:complete", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();
            calls = [];
            dependenciesResult = [
                {
                    name: "left-pad",
                    currentVersion: "1.0.0",
                    latestInRange: "1.0.0",
                    latestVersion: "1.0.0",
                    type: "dependency",
                    upgradeType: "none"
                }
            ];
            securityResult = { passes: false, checks: { enableScripts: false } };

            fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();
            expect(presenter.vm.dependencies).toHaveLength(1);
            expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
            expect(presenter.vm.security).toEqual(securityResult);
            expect(calls.some(c => c.route === getProjectDependenciesRoute)).toBe(true);
            expect(calls.some(c => c.route === getProjectSecurityRoute)).toBe(true);
        });

        it("ignores scan:complete events for a different project", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();

            fakeEventBridge.emit("scan:complete", { projectId: "other-project", warning: null });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(true);
        });

        it("clears scanning and scanProgress on scan:failed and exposes error message", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();
            fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 1,
                total: 10
            });

            fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();
            expect(presenter.vm.scanError).toBe("boom");
        });

        it("clears scanError when a new scan starts", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();
            fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });
            expect(presenter.vm.scanError).toBe("boom");

            await presenter.scan();

            expect(presenter.vm.scanError).toBeNull();
        });

        it("does not leak scanning/progress state into a different project navigated to afterwards", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            await presenter.scan();

            fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 3,
                total: 10
            });
            expect(presenter.vm.scanning).toBe(true);
            expect(presenter.vm.scanProgress).toEqual({
                packageName: "lodash",
                current: 3,
                total: 10
            });

            // Navigate away to project B while A is still scanning.
            await loadAndFlush(presenter, "p2");

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();

            // A's scan:complete arrives after navigation - it must not affect B's view model.
            fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();

            // Navigating back to A should show it as no longer scanning (completed while away).
            await loadAndFlush(presenter, "p1");
            expect(presenter.vm.scanning).toBe(false);
        });
    });

    describe("transitive-resolve:complete", () => {
        it("reloads dependencies for the current project", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            calls = [];
            dependenciesResult = [
                {
                    name: "left-pad",
                    currentVersion: "1.0.0",
                    latestInRange: "1.0.0",
                    latestVersion: "1.0.0",
                    type: "transitive",
                    upgradeType: "none"
                }
            ];

            fakeEventBridge.emit("transitive-resolve:complete", {
                projectId: "p1",
                resolved: 1,
                failed: 0
            });
            await flushMicrotasks();

            expect(presenter.vm.dependencies).toHaveLength(1);
            expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
            expect(calls.some(c => c.route === getProjectDependenciesRoute)).toBe(true);
        });

        it("ignores events for a different project", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            calls = [];

            fakeEventBridge.emit("transitive-resolve:complete", {
                projectId: "other-project",
                resolved: 5,
                failed: 0
            });
            await flushMicrotasks();

            expect(calls.some(c => c.route === getProjectDependenciesRoute)).toBe(false);
        });
    });

    it("toggles package selection and updates selectedCount and canUpgrade", async () => {
        const presenter = createPresenter();
        dependenciesResult = [
            {
                name: "left-pad",
                currentVersion: "1.0.0",
                latestInRange: "1.2.0",
                latestVersion: "2.0.0",
                type: "dependency",
                upgradeType: "minor"
            },
            {
                name: "chalk",
                currentVersion: "4.0.0",
                latestInRange: "4.1.0",
                latestVersion: "5.0.0",
                type: "devDependency",
                upgradeType: "major"
            }
        ];
        await loadAndFlush(presenter, "p1");

        presenter.togglePackage("left-pad");

        expect(presenter.vm.selectedCount).toBe(1);
        expect(presenter.vm.canUpgrade).toBe(true);
        expect(
            presenter.vm.dependencies.find(dependency => dependency.name === "left-pad")?.selected
        ).toBe(true);

        presenter.togglePackage("left-pad");

        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.canUpgrade).toBe(false);
    });

    it("selects and deselects all packages", async () => {
        const presenter = createPresenter();
        dependenciesResult = [
            {
                name: "left-pad",
                currentVersion: "1.0.0",
                latestInRange: "1.2.0",
                latestVersion: "2.0.0",
                type: "dependency",
                upgradeType: "minor"
            },
            {
                name: "chalk",
                currentVersion: "4.0.0",
                latestInRange: "4.1.0",
                latestVersion: "5.0.0",
                type: "devDependency",
                upgradeType: "major"
            }
        ];
        await loadAndFlush(presenter, "p1");

        presenter.selectAll();
        expect(presenter.vm.selectedCount).toBe(2);
        expect(presenter.vm.dependencies.every(dependency => dependency.selected)).toBe(true);

        presenter.deselectAll();
        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.dependencies.every(dependency => !dependency.selected)).toBe(true);
    });

    it("refreshes transient dependencies for the loaded project", async () => {
        const presenter = createPresenter();
        await loadAndFlush(presenter, "p1");
        calls = [];

        await presenter.refreshTransient();

        expect(calls).toEqual([{ route: createTransientJobRoute, args: { params: { id: "p1" } } }]);
    });

    it("updates the package manager version via setPackageManagerUpdateVersion and updatePackageManager", async () => {
        const presenter = createPresenter();
        await loadAndFlush(presenter, "p1");
        calls = [];

        presenter.setPackageManagerUpdateVersion("4.2.0");
        expect(presenter.vm.packageManagerUpdateVersion).toBe("4.2.0");

        await presenter.updatePackageManager();

        expect(calls).toEqual([
            {
                route: updatePackageManagerRoute,
                args: { params: { id: "p1" }, body: { version: "4.2.0" } }
            }
        ]);
    });

    describe("schedule", () => {
        it("exposes the resolved schedule for the loaded project", async () => {
            const presenter = createPresenter();
            scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "24h",
                    source: "default",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            scanScheduleGlobalDefault = "24h";

            await loadAndFlush(presenter, "p1");

            expect(presenter.vm.schedule).toEqual({
                interval: "24h",
                source: "default",
                globalDefault: "24h"
            });
        });

        it("is null when no schedule exists for the project", async () => {
            const presenter = createPresenter();

            await loadAndFlush(presenter, "p1");

            expect(presenter.vm.schedule).toBeNull();
        });

        it("updateSchedule calls gateway and reflects the project-level override", async () => {
            const presenter = createPresenter();
            scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "24h",
                    source: "default",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            scanScheduleGlobalDefault = "24h";
            await loadAndFlush(presenter, "p1");
            calls = [];

            await presenter.updateSchedule("6h");

            expect(calls).toEqual([
                {
                    route: upsertScanScheduleRoute,
                    args: { params: { projectId: "p1" }, body: { interval: "6h" } }
                }
            ]);
            expect(presenter.vm.schedule).toEqual({
                interval: "6h",
                source: "project",
                globalDefault: "24h"
            });
        });

        it("resetSchedule calls gateway and reverts to the global default", async () => {
            const presenter = createPresenter();
            scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "6h",
                    source: "project",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            scanScheduleGlobalDefault = "24h";
            await loadAndFlush(presenter, "p1");
            calls = [];

            await presenter.resetSchedule();

            expect(calls).toEqual([
                { route: deleteScanScheduleRoute, args: { params: { projectId: "p1" } } }
            ]);
            expect(presenter.vm.schedule).toEqual({
                interval: "24h",
                source: "default",
                globalDefault: "24h"
            });
        });

        it("updateSchedule and resetSchedule are no-ops without a loaded project", async () => {
            const presenter = createPresenter();

            await presenter.updateSchedule("6h");
            await presenter.resetSchedule();

            expect(calls.some(c => c.route === upsertScanScheduleRoute)).toBe(false);
            expect(calls.some(c => c.route === deleteScanScheduleRoute)).toBe(false);
        });
    });

    describe("auto-fix", () => {
        it("loads auto-fix settings into the view model", async () => {
            const presenter = createPresenter();

            await loadAndFlush(presenter, "p1");

            expect(presenter.vm.autoFixSettings).toEqual({
                enabled: false,
                upgradeTypes: ["patch", "minor"],
                groupingStrategy: "single",
                branchPrefix: "auto-fix/"
            });
        });

        it("loads the auto-fix pull request list into the view model", async () => {
            const presenter = createPresenter();
            autoFixPullRequestsResult = [
                {
                    id: "pr-1",
                    projectId: "p1",
                    packageNames: ["left-pad"],
                    fromVersions: { "left-pad": "1.0.0" },
                    toVersions: { "left-pad": "1.2.0" },
                    upgradeType: "minor",
                    branchName: "auto-fix/left-pad-1.2.0",
                    prUrl: "https://example.com/pr/1",
                    prNumber: 1,
                    status: "open",
                    licenseWarnings: [],
                    createdAt: 0,
                    updatedAt: 0
                }
            ];

            await loadAndFlush(presenter, "p1");

            expect(presenter.vm.autoFixPullRequests).toEqual([
                {
                    id: "pr-1",
                    packageNames: ["left-pad"],
                    fromVersions: { "left-pad": "1.0.0" },
                    toVersions: { "left-pad": "1.2.0" },
                    upgradeType: "minor",
                    branchName: "auto-fix/left-pad-1.2.0",
                    prUrl: "https://example.com/pr/1",
                    prNumber: 1,
                    status: "open",
                    licenseWarnings: []
                }
            ]);
        });

        it("updateAutoFixSettings calls the gateway and reflects the change in the view model", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            calls = [];

            await presenter.updateAutoFixSettings({ enabled: true });

            expect(calls).toEqual([
                {
                    route: updateAutoFixSettingsRoute,
                    args: { params: { projectId: "p1" }, body: { enabled: true } }
                }
            ]);
            expect(presenter.vm.autoFixSettings?.enabled).toBe(true);
        });

        it("updateAutoFixSettings is a no-op without a loaded project", async () => {
            const presenter = createPresenter();

            await presenter.updateAutoFixSettings({ enabled: true });

            expect(calls.some(c => c.route === updateAutoFixSettingsRoute)).toBe(false);
        });

        it("generateAutoFixPrs sets autoFixRunning while in flight and refreshes the PR list", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            calls = [];
            autoFixPullRequestsResult = [
                {
                    id: "pr-2",
                    projectId: "p1",
                    packageNames: ["chalk"],
                    fromVersions: { chalk: "4.0.0" },
                    toVersions: { chalk: "5.0.0" },
                    upgradeType: "major",
                    branchName: "auto-fix/chalk-5.0.0",
                    prUrl: null,
                    prNumber: null,
                    status: "pending",
                    licenseWarnings: [],
                    createdAt: 0,
                    updatedAt: 0
                }
            ];

            const pending = presenter.generateAutoFixPrs();
            expect(presenter.vm.autoFixRunning).toBe(true);
            await pending;

            expect(presenter.vm.autoFixRunning).toBe(false);
            expect(calls.some(c => c.route === generateAutoFixPrRoute)).toBe(true);
            expect(calls.some(c => c.route === getProjectAutoFixPullRequestsRoute)).toBe(true);
            expect(presenter.vm.autoFixPullRequests).toHaveLength(1);
            expect(presenter.vm.autoFixPullRequests[0]?.id).toBe("pr-2");
        });

        it("generateAutoFixPrs is a no-op without a loaded project", async () => {
            const presenter = createPresenter();

            await presenter.generateAutoFixPrs();

            expect(calls.some(c => c.route === generateAutoFixPrRoute)).toBe(false);
            expect(presenter.vm.autoFixRunning).toBe(false);
        });
    });

    describe("exportSbom", () => {
        beforeEach(() => {
            // downloadBlob() reaches into the DOM to trigger a file download; this
            // suite runs without jsdom, so a minimal anchor/document stub is provided.
            vi.stubGlobal("document", {
                createElement: () => ({
                    href: "",
                    download: "",
                    click: () => {},
                    remove: () => {}
                }),
                body: {
                    appendChild: () => {}
                }
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("exports the project SBOM in the requested format and triggers a download", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            sbomExportResult = { blob: new Blob(["cyclonedx-content"]), filename: "p1-sbom.json" };

            await presenter.exportSbom("cyclonedx");

            expect(sbomExportCalls).toEqual([{ projectId: "p1", format: "cyclonedx" }]);
            expect(presenter.vm.exportingSbom).toBe(false);
            expect(presenter.vm.sbomExportError).toBeNull();
        });

        it("sets exportingSbom true while the export is in flight, then false", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");

            const pending = presenter.exportSbom("spdx");
            expect(presenter.vm.exportingSbom).toBe(true);
            await pending;

            expect(presenter.vm.exportingSbom).toBe(false);
        });

        it("captures the error message when the export fails", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            sbomExportShouldFail = new Error("export failed");

            await presenter.exportSbom("cyclonedx");

            expect(presenter.vm.sbomExportError).toBe("export failed");
            expect(presenter.vm.exportingSbom).toBe(false);
        });

        it("clears a previous export error when a new export succeeds", async () => {
            const presenter = createPresenter();
            await loadAndFlush(presenter, "p1");
            sbomExportShouldFail = new Error("export failed");
            await presenter.exportSbom("cyclonedx");
            expect(presenter.vm.sbomExportError).toBe("export failed");

            sbomExportShouldFail = null;
            await presenter.exportSbom("cyclonedx");

            expect(presenter.vm.sbomExportError).toBeNull();
        });

        it("is a no-op without a loaded project", async () => {
            const presenter = createPresenter();

            await presenter.exportSbom("cyclonedx");

            expect(sbomExportCalls).toEqual([]);
            expect(presenter.vm.exportingSbom).toBe(false);
        });
    });

    describe("teams", () => {
        it("loads the project's assigned teams and the available team options on load", async () => {
            const presenter = createPresenter();
            teamsListResult = [
                {
                    id: "team-1",
                    name: "Platform",
                    color: "#ff0000",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                }
            ];
            projectTeamsResult = [{ id: "team-1", name: "Platform", color: "#ff0000" }];

            await loadAndFlush(presenter, "p1");

            expect(presenter.vm.projectTeamIds).toEqual(["team-1"]);
            expect(presenter.vm.availableTeams).toEqual([
                { id: "team-1", name: "Platform", color: "#ff0000" }
            ]);
        });

        it("setProjectTeams persists the selection and refreshes the assigned team IDs", async () => {
            const presenter = createPresenter();
            teamsListResult = [
                {
                    id: "team-1",
                    name: "Platform",
                    color: "#ff0000",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                },
                {
                    id: "team-2",
                    name: "Growth",
                    color: "#00ff00",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                }
            ];
            await loadAndFlush(presenter, "p1");
            expect(presenter.vm.projectTeamIds).toEqual([]);

            await presenter.setProjectTeams(["team-1", "team-2"]);

            expect(calls.some(c => c.route === setProjectTeamsRoute)).toBe(true);
            expect(presenter.vm.projectTeamIds).toEqual(["team-1", "team-2"]);
        });

        it("setProjectTeams is a no-op without a loaded project", async () => {
            const presenter = createPresenter();

            await presenter.setProjectTeams(["team-1"]);

            expect(calls.some(c => c.route === setProjectTeamsRoute)).toBe(false);
        });
    });
});
