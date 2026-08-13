import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    listProjectsRoute,
    createProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    cloneProjectRoute,
    browseFilesystemRoute,
    getEngineSummaryRoute,
    bulkScanProjectsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../infrastructure/HttpClient/feature.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { UpgradesFeature } from "../../../../features/Upgrades/feature.js";
import { FilesystemFeature } from "../../../../features/Filesystem/feature.js";
import { EventBridge } from "../../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../../infrastructure/Events/eventMap.js";
import { TeamFilterFeature } from "../../../../features/TeamFilter/feature.js";
import { EnginesFeature } from "../../../../features/Engines/feature.js";
import type { EnginesGateway } from "../../../../features/Engines/abstractions/EnginesGateway.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../useCases/LoadProjectsUseCase.js";
import { AddProjectUseCase as AddProjectUseCaseRegistration } from "../../useCases/AddProjectUseCase.js";
import { RemoveProjectUseCase as RemoveProjectUseCaseRegistration } from "../../useCases/RemoveProjectUseCase.js";
import { ScanProjectUseCase as ScanProjectUseCaseRegistration } from "../../useCases/ScanProjectUseCase.js";
import { CheckSecurityUseCase as CheckSecurityUseCaseRegistration } from "../../useCases/CheckSecurityUseCase.js";
import { CloneProjectUseCase as CloneProjectUseCaseRegistration } from "../../useCases/CloneProjectUseCase.js";
import { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { ProjectListPresenter as ProjectListPresenterRegistration } from "../ProjectListPresenter.js";
import { CloneManagerFactory as CloneManagerFactoryRegistration } from "../CloneManagerFactory.js";
import { DirectoryScanManagerFactory as DirectoryScanManagerFactoryRegistration } from "../DirectoryScanManagerFactory.js";
import { ScanStatusManagerFactory as ScanStatusManagerFactoryRegistration } from "../ScanStatusManagerFactory.js";

export interface IRecordedCall {
    route: unknown;
    args: unknown;
}

export interface IFakeEventBridge {
    bridge: EventBridge.Interface;
    emit: <K extends EventBridge.EventName>(event: K, data: EventBridge.EventMap[K]) => void;
    listenerCount: (event: EventBridge.EventName) => number;
}

export function createFakeEventBridge(): IFakeEventBridge {
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

/**
 * Mutable test harness shared across the split ProjectListPresenter test
 * files. Each test sets the relevant response fields before calling
 * createPresenter(), mirroring the closure-captured `let` variables the
 * presenter test file used before the split. A fresh harness should be
 * created in beforeEach so state never leaks between tests.
 */
export interface IProjectListPresenterTestHarness {
    calls: IRecordedCall[];
    getResult: unknown;
    postResult: unknown;
    postError: Error | null;
    scanJobId: string;
    cloneJobId: string;
    cloneError: Error | null;
    browseItems: { name: string; path: string }[];
    engineSummaryResult: EnginesGateway.SummaryData;
    fakeEventBridge: IFakeEventBridge;
    bulkScanResult: { enqueuedCount: number; skippedCount: number };
    bulkScanError: Error | null;
    createPresenter: () => ProjectListPresenter.Interface;
}

export function createProjectListPresenterTestHarness(): IProjectListPresenterTestHarness {
    const harness: IProjectListPresenterTestHarness = {
        calls: [],
        getResult: [],
        postResult: undefined,
        postError: null,
        scanJobId: "scan-job-1",
        cloneJobId: "clone-job-1",
        cloneError: null,
        browseItems: [],
        bulkScanResult: { enqueuedCount: 0, skippedCount: 0 },
        bulkScanError: null,
        engineSummaryResult: {
            totalProjects: 0,
            counts: { eol: 0, maintenance: 0, activeLts: 0, current: 0, unknown: 0 },
            projectSummaries: [],
            staleProjectCount: 0,
            stalenessThresholdMs: 604800000
        },
        fakeEventBridge: createFakeEventBridge(),
        createPresenter: (): ProjectListPresenter.Interface => {
            const container: Container = createContainer();

            // Real HTTPClient feature is registered first; the mock instance below
            // takes precedence over it (instance registrations win over class
            // registrations in @webiny/di), so only the HTTP boundary is mocked.
            HTTPClientFeature.register(container);
            container.registerInstance(HTTPClient, {
                request: async <T>(route: unknown, args: unknown): Promise<T> => {
                    harness.calls.push({ route, args });
                    if (harness.postError) {
                        throw harness.postError;
                    }
                    switch (route) {
                        case listProjectsRoute:
                            return {
                                items: harness.getResult,
                                total: (harness.getResult as []).length
                            } as T;
                        case getProjectSecurityRoute:
                        case checkProjectSecurityRoute:
                            return { item: { passes: true, checks: {} } } as T;
                        case scanProjectAsyncRoute:
                            return { item: { jobId: harness.scanJobId } } as T;
                        case createProjectRoute:
                            return { item: harness.postResult } as T;
                        case deleteProjectRoute:
                            return undefined as T;
                        case cloneProjectRoute:
                            if (harness.cloneError) {
                                throw harness.cloneError;
                            }
                            return { item: { jobId: harness.cloneJobId } } as T;
                        case browseFilesystemRoute: {
                            const browsePath =
                                (args as { query?: { path?: string } })?.query?.path ??
                                "/mock/cwd";
                            return {
                                items: harness.browseItems,
                                total: harness.browseItems.length,
                                currentPath: browsePath
                            } as T;
                        }
                        case getEngineSummaryRoute:
                            return harness.engineSummaryResult as T;
                        case bulkScanProjectsRoute:
                            if (harness.bulkScanError) {
                                throw harness.bulkScanError;
                            }
                            return harness.bulkScanResult as T;
                        default:
                            throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                    }
                }
            });

            harness.fakeEventBridge = createFakeEventBridge();
            container.registerInstance(EventBridge, harness.fakeEventBridge.bridge);

            ProjectsFeature.register(container);
            UpgradesFeature.register(container);
            FilesystemFeature.register(container);
            TeamFilterFeature.register(container);
            EnginesFeature.register(container);
            container.register(LoadProjectsUseCaseRegistration);
            container.register(AddProjectUseCaseRegistration);
            container.register(RemoveProjectUseCaseRegistration);
            container.register(ScanProjectUseCaseRegistration);
            container.register(CheckSecurityUseCaseRegistration);
            container.register(CloneProjectUseCaseRegistration);
            container.register(CloneManagerFactoryRegistration).inSingletonScope();
            container.register(DirectoryScanManagerFactoryRegistration).inSingletonScope();
            container.register(ScanStatusManagerFactoryRegistration).inSingletonScope();
            container.register(ProjectListPresenterRegistration);

            return container.resolve(ProjectListPresenter);
        }
    };

    return harness;
}
