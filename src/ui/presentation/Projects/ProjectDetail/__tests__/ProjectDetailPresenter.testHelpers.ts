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
    setProjectTeamsRoute,
    getProjectEngineChecksRoute,
    getProjectEngineStalenessRoute,
    scanProjectEnginesRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../infrastructure/HttpClient/feature.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { UpgradesFeature } from "../../../../features/Upgrades/feature.js";
import { ScanSchedulesFeature } from "../../../../features/ScanSchedules/index.js";
import { VulnerabilitiesFeature } from "../../../../features/Vulnerabilities/feature.js";
import { LicensesFeature } from "../../../../features/Licenses/feature.js";
import { AutoFixFeature } from "../../../../features/AutoFix/feature.js";
import { TeamsFeature } from "../../../../features/Teams/feature.js";
import { TeamFilterFeature } from "../../../../features/TeamFilter/feature.js";
import { EnginesFeature } from "../../../../features/Engines/feature.js";
import { ChangelogsFeature } from "../../../../features/Changelogs/feature.js";
import { SbomGateway as SbomGatewayAbstraction } from "../../../../features/Sbom/abstractions/SbomGateway.js";
import { EventBridge } from "../../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../../infrastructure/Events/eventMap.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../useCases/LoadProjectsUseCase.js";
import { ScanProjectUseCase as ScanProjectUseCaseRegistration } from "../../useCases/ScanProjectUseCase.js";
import { CheckSecurityUseCase as CheckSecurityUseCaseRegistration } from "../../useCases/CheckSecurityUseCase.js";
import { UpgradePackagesUseCase as UpgradePackagesUseCaseRegistration } from "../../../Upgrades/useCases/UpgradePackagesUseCase.js";
import { RefreshTransientUseCase as RefreshTransientUseCaseRegistration } from "../../../Upgrades/useCases/RefreshTransientUseCase.js";
import { UpdatePackageManagerUseCase as UpdatePackageManagerUseCaseRegistration } from "../../../Upgrades/useCases/UpdatePackageManagerUseCase.js";
import { LoadScanSchedulesUseCase as LoadScanSchedulesUseCaseRegistration } from "../../../ScanSchedules/useCases/LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase as UpdateScanScheduleUseCaseRegistration } from "../../../ScanSchedules/useCases/UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase as ResetScanScheduleUseCaseRegistration } from "../../../ScanSchedules/useCases/ResetScanScheduleUseCase.js";
import { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter as ProjectDetailPresenterRegistration } from "../ProjectDetailPresenter.js";
import { UrlFilterService } from "../../../../features/UrlFilter/abstractions/UrlFilterService.js";

export interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface FakeEventBridge {
    bridge: EventBridge.Interface;
    emit: <K extends EventBridge.EventName>(event: K, data: EventBridge.EventMap[K]) => void;
    listenerCount: (event: EventBridge.EventName) => number;
}

interface SbomExportCall {
    projectId: string;
    format: string;
}

interface SbomExportResult {
    blob: Blob;
    filename: string;
}

interface Team {
    id: string;
    name: string;
    color: string;
}

export interface ProjectDetailTestContext {
    calls: RecordedCall[];
    projectsListResult: unknown;
    dependenciesResult: unknown;
    securityResult: unknown;
    upgradeResult: unknown;
    transientResult: unknown;
    packageManagerResult: unknown;
    scanJobId: string;
    scanSchedulesItems: unknown;
    scanScheduleGlobalDefault: string;
    vulnerabilitiesResult: unknown;
    licensesResult: unknown;
    autoFixSettingsResult: Record<string, unknown>;
    autoFixPullRequestsResult: unknown[];
    autoFixGenerateJobId: string;
    fakeEventBridge: FakeEventBridge;
    sbomExportCalls: SbomExportCall[];
    sbomExportResult: SbomExportResult;
    sbomExportShouldFail: Error | null;
    teamsListResult: unknown[];
    projectTeamsResult: Team[];
    engineChecksResult: unknown[];
    engineStalenessResult: unknown;
    engineScanResult: unknown;
    engineScanError: Error | null;
    createPresenter: () => ProjectDetailPresenter.Interface;
    loadAndFlush: (presenter: ProjectDetailPresenter.Interface, projectId: string) => Promise<void>;
}

export async function flushMicrotasks(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

function createFakeEventBridge(): FakeEventBridge {
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

function createPresenterForContext(
    ctx: ProjectDetailTestContext
): ProjectDetailPresenter.Interface {
    const container: Container = createContainer();

    // Real HTTPClient feature is registered first; the mock instance below
    // takes precedence over it (instance registrations win over class
    // registrations in @webiny/di), so only the HTTP boundary is mocked.
    HTTPClientFeature.register(container);
    container.registerInstance(HTTPClient, {
        request: async <T>(route: unknown, args: unknown): Promise<T> => {
            ctx.calls.push({ route, args });
            switch (route) {
                case listProjectsRoute:
                    return {
                        items: ctx.projectsListResult,
                        total: (ctx.projectsListResult as []).length
                    } as T;
                case getProjectSecurityRoute:
                case checkProjectSecurityRoute:
                    return { item: ctx.securityResult } as T;
                case getProjectDependenciesRoute:
                    return {
                        items: ctx.dependenciesResult,
                        total: (ctx.dependenciesResult as []).length
                    } as T;
                case scanProjectAsyncRoute:
                    return { item: { jobId: ctx.scanJobId } } as T;
                case createUpgradeJobRoute:
                    return { item: ctx.upgradeResult } as T;
                case createTransientJobRoute:
                    return { item: ctx.transientResult } as T;
                case updatePackageManagerRoute:
                    return { item: ctx.packageManagerResult } as T;
                case listScanSchedulesRoute:
                    return {
                        items: ctx.scanSchedulesItems,
                        globalDefault: ctx.scanScheduleGlobalDefault
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
                        items: ctx.vulnerabilitiesResult,
                        total: (ctx.vulnerabilitiesResult as []).length
                    } as T;
                case getProjectLicensesRoute:
                    return {
                        items: ctx.licensesResult,
                        total: (ctx.licensesResult as []).length
                    } as T;
                case getAutoFixSettingsRoute:
                    return ctx.autoFixSettingsResult as T;
                case updateAutoFixSettingsRoute: {
                    const updateArgs = args as {
                        params: { projectId: string };
                        body: Record<string, unknown>;
                    };
                    ctx.autoFixSettingsResult = {
                        ...ctx.autoFixSettingsResult,
                        ...updateArgs.body
                    };
                    return ctx.autoFixSettingsResult as T;
                }
                case getProjectAutoFixPullRequestsRoute:
                    return {
                        items: ctx.autoFixPullRequestsResult,
                        total: ctx.autoFixPullRequestsResult.length
                    } as T;
                case generateAutoFixPrRoute:
                    return { jobId: ctx.autoFixGenerateJobId } as T;
                case listTeamsRoute:
                    return {
                        items: ctx.teamsListResult,
                        total: ctx.teamsListResult.length
                    } as T;
                case getProjectTeamsRoute:
                    return {
                        items: ctx.projectTeamsResult,
                        total: ctx.projectTeamsResult.length
                    } as T;
                case getProjectEngineChecksRoute:
                    return {
                        items: ctx.engineChecksResult,
                        total: ctx.engineChecksResult.length
                    } as T;
                case getProjectEngineStalenessRoute:
                    return ctx.engineStalenessResult as T;
                case scanProjectEnginesRoute:
                    if (ctx.engineScanError) {
                        throw ctx.engineScanError;
                    }
                    return ctx.engineScanResult as T;
                case setProjectTeamsRoute: {
                    const setTeamsArgs = args as { body: { teamIds: string[] } };
                    ctx.projectTeamsResult = setTeamsArgs.body.teamIds.map(
                        teamId =>
                            ctx.projectTeamsResult.find(team => team.id === teamId) ?? {
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

    ctx.fakeEventBridge = createFakeEventBridge();
    container.registerInstance(EventBridge, ctx.fakeEventBridge.bridge);

    container.registerInstance(SbomGatewayAbstraction, {
        exportProject: async (projectId: string, format: string) => {
            ctx.sbomExportCalls.push({ projectId, format });
            if (ctx.sbomExportShouldFail) {
                throw ctx.sbomExportShouldFail;
            }
            return ctx.sbomExportResult;
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
    EnginesFeature.register(container);
    ChangelogsFeature.register(container);
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

export function createProjectDetailTestContext(): ProjectDetailTestContext {
    const ctx: ProjectDetailTestContext = {
        calls: [],
        projectsListResult: [],
        dependenciesResult: [],
        securityResult: {
            passes: true,
            checks: {
                npmPreapprovedPackages: true,
                npmMinimalAgeGate: true,
                enableScripts: true,
                approvedGitRepositories: true
            }
        },
        upgradeResult: { jobId: "job-1" },
        transientResult: { jobId: "job-2" },
        packageManagerResult: { jobId: "job-3" },
        scanJobId: "scan-job-1",
        scanSchedulesItems: [],
        scanScheduleGlobalDefault: "disabled",
        vulnerabilitiesResult: [],
        licensesResult: [],
        autoFixSettingsResult: {
            id: "af-1",
            projectId: "p1",
            enabled: false,
            upgradeTypes: ["patch", "minor"],
            groupingStrategy: "single",
            branchPrefix: "auto-fix/",
            createdAt: 0,
            updatedAt: 0
        },
        autoFixPullRequestsResult: [],
        autoFixGenerateJobId: "af-job-1",
        fakeEventBridge: createFakeEventBridge(),
        sbomExportCalls: [],
        sbomExportResult: { blob: new Blob(["sbom-content"]), filename: "sbom.json" },
        sbomExportShouldFail: null,
        teamsListResult: [],
        projectTeamsResult: [],
        engineChecksResult: [],
        engineStalenessResult: {
            lastScannedAt: null,
            engineScanStale: false,
            engineScanStaleReason: null,
            stalenessThresholdMs: 604_800_000
        },
        engineScanResult: {
            rootStatus: "current",
            rootEnginesNode: ">=20",
            findings: [],
            summary: {
                totalProjects: 1,
                counts: { eol: 0, maintenance: 0, activeLts: 0, current: 1, unknown: 0 },
                projectSummaries: [],
                staleProjectCount: 0,
                stalenessThresholdMs: 604_800_000
            }
        },
        engineScanError: null,
        createPresenter: () => createPresenterForContext(ctx),
        loadAndFlush: async (presenter, projectId) => {
            await presenter.load(projectId);
            await flushMicrotasks();
        }
    };

    return ctx;
}
