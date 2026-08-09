import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { generateId } from "@webiny/stdlib";
import {
    listProjectsRoute,
    createProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    cloneProjectRoute,
    browseFilesystemRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../infrastructure/HttpClient/feature.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import type { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";
import { UpgradesFeature } from "../../../../features/Upgrades/feature.js";
import { FilesystemFeature } from "../../../../features/Filesystem/feature.js";
import { EventBridge } from "../../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../../infrastructure/Events/eventMap.js";
import { TeamFilterFeature } from "../../../../features/TeamFilter/feature.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../useCases/LoadProjectsUseCase.js";
import { AddProjectUseCase as AddProjectUseCaseRegistration } from "../../useCases/AddProjectUseCase.js";
import { RemoveProjectUseCase as RemoveProjectUseCaseRegistration } from "../../useCases/RemoveProjectUseCase.js";
import { ScanProjectUseCase as ScanProjectUseCaseRegistration } from "../../useCases/ScanProjectUseCase.js";
import { CheckSecurityUseCase as CheckSecurityUseCaseRegistration } from "../../useCases/CheckSecurityUseCase.js";
import { CloneProjectUseCase as CloneProjectUseCaseRegistration } from "../../useCases/CloneProjectUseCase.js";
import { ProjectListPresenter } from "../abstractions/ProjectListPresenter.js";
import { ProjectListPresenter as ProjectListPresenterRegistration } from "../ProjectListPresenter.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
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

describe("ProjectListPresenter", () => {
    let calls: RecordedCall[];
    let getResult: unknown;
    let postResult: unknown;
    let postError: Error | null;
    let scanJobId: string;
    let cloneJobId: string;
    let cloneError: Error | null;
    let browseItems: { name: string; path: string }[];
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;

    function createPresenter(): ProjectListPresenter.Interface {
        const container: Container = createContainer();

        // Real HTTPClient feature is registered first; the mock instance below
        // takes precedence over it (instance registrations win over class
        // registrations in @webiny/di), so only the HTTP boundary is mocked.
        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (postError) {
                    throw postError;
                }
                switch (route) {
                    case listProjectsRoute:
                        return { items: getResult, total: (getResult as []).length } as T;
                    case getProjectSecurityRoute:
                    case checkProjectSecurityRoute:
                        return { item: { passes: true, checks: {} } } as T;
                    case scanProjectAsyncRoute:
                        return { item: { jobId: scanJobId } } as T;
                    case createProjectRoute:
                        return { item: postResult } as T;
                    case deleteProjectRoute:
                        return undefined as T;
                    case cloneProjectRoute:
                        if (cloneError) {
                            throw cloneError;
                        }
                        return { item: { jobId: cloneJobId } } as T;
                    case browseFilesystemRoute: {
                        const browsePath =
                            (args as { query?: { path?: string } })?.query?.path ?? "/mock/cwd";
                        return {
                            items: browseItems,
                            total: browseItems.length,
                            currentPath: browsePath
                        } as T;
                    }
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        ProjectsFeature.register(container);
        UpgradesFeature.register(container);
        FilesystemFeature.register(container);
        TeamFilterFeature.register(container);
        container.register(LoadProjectsUseCaseRegistration);
        container.register(AddProjectUseCaseRegistration);
        container.register(RemoveProjectUseCaseRegistration);
        container.register(ScanProjectUseCaseRegistration);
        container.register(CheckSecurityUseCaseRegistration);
        container.register(CloneProjectUseCaseRegistration);
        container.register(ProjectListPresenterRegistration);

        return container.resolve(ProjectListPresenter);
    }

    beforeEach(() => {
        calls = [];
        getResult = [];
        postResult = undefined;
        postError = null;
        scanJobId = "scan-job-1";
        cloneJobId = "clone-job-1";
        cloneError = null;
        browseItems = [];
    });

    it("starts with an empty, idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            bulkActionRunning: false,
            projects: [],
            addProjectPath: "",
            addProjectLoading: false,
            addProjectError: null,
            cloneUrl: "",
            cloneFolderName: "",
            cloneLoading: false,
            cloneError: null,
            browsePath: "",
            browseItems: [],
            browseLoading: false,
            scanResults: [],
            scanLoading: false,
            scanSummary: null,
            scanDepth: 1,
            searchQuery: ""
        });
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = createPresenter();

        const pending = presenter.load();
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("loads projects and maps them into view-ready items with an idle scan status", async () => {
        const presenter = createPresenter();
        const projects: ProjectsGateway.Project[] = [
            {
                id: "p1",
                name: "with-security",
                path: "/tmp/with-security",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: 2000,
                security: { passes: true, checks: { enableScripts: true } },
                hasNodeModules: false
            },
            {
                id: "p2",
                name: "no-security",
                path: "/tmp/no-security",
                pmVersion: null,
                packageManager: null,
                addedAt: 1500,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        getResult = projects;

        await presenter.load();

        expect(calls).toEqual([{ route: listProjectsRoute, args: { params: {} } }]);
        expect(presenter.vm.projects).toEqual([
            {
                id: "p1",
                name: "with-security",
                path: "/tmp/with-security",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                securityPasses: true,
                securityChecks: { enableScripts: true },
                lastScannedAt: 2000,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: []
            },
            {
                id: "p2",
                name: "no-security",
                path: "/tmp/no-security",
                pmVersion: null,
                packageManager: null,
                securityPasses: null,
                securityChecks: null,
                lastScannedAt: null,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: []
            }
        ]);
    });

    it("updates addProjectPath via setAddProjectPath", () => {
        const presenter = createPresenter();

        presenter.setAddProjectPath("/tmp/new-project");

        expect(presenter.vm.addProjectPath).toBe("/tmp/new-project");
    });

    it("adds a project, appends it to the list, and clears the path on success", async () => {
        const presenter = createPresenter();
        const created: ProjectsGateway.Project = {
            id: "p3",
            name: "new-project",
            path: "/tmp/new-project",
            pmVersion: null,
            packageManager: null,
            addedAt: 3000,
            lastScannedAt: null,
            hasNodeModules: false
        };
        postResult = created;

        presenter.setAddProjectPath("/tmp/new-project");
        await presenter.addProject();

        expect(calls).toEqual([
            {
                route: createProjectRoute,
                args: { params: {}, body: { path: "/tmp/new-project" } }
            }
        ]);
        expect(presenter.vm.addProjectPath).toBe("");
        expect(presenter.vm.addProjectLoading).toBe(false);
        expect(presenter.vm.addProjectError).toBeNull();
        expect(presenter.vm.projects).toEqual([
            {
                id: "p3",
                name: "new-project",
                path: "/tmp/new-project",
                pmVersion: null,
                packageManager: null,
                securityPasses: null,
                securityChecks: null,
                lastScannedAt: null,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: []
            }
        ]);
    });

    it("records an error and keeps the path when adding a project fails", async () => {
        const presenter = createPresenter();
        postError = new Error("Path is not a valid Yarn project");

        presenter.setAddProjectPath("/tmp/bad-project");
        await presenter.addProject();

        expect(presenter.vm.addProjectError).toBe("Path is not a valid Yarn project");
        expect(presenter.vm.addProjectLoading).toBe(false);
        expect(presenter.vm.addProjectPath).toBe("/tmp/bad-project");
        expect(presenter.vm.projects).toEqual([]);
    });

    it("removes a project from the list", async () => {
        const presenter = createPresenter();
        const remaining: ProjectsGateway.Project = {
            id: "p1",
            name: "keep-me",
            path: "/tmp/keep-me",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1000,
            lastScannedAt: null,
            hasNodeModules: false
        };
        const removed: ProjectsGateway.Project = {
            id: "p2",
            name: "remove-me",
            path: "/tmp/remove-me",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1500,
            lastScannedAt: null,
            hasNodeModules: false
        };
        getResult = [remaining, removed];
        await presenter.load();

        await presenter.removeProject("p2");

        expect(calls).toEqual([
            { route: listProjectsRoute, args: { params: {} } },
            { route: deleteProjectRoute, args: { params: { id: "p2" } } }
        ]);
        expect(presenter.vm.projects.map(project => project.id)).toEqual(["p1"]);
    });

    describe("scanAll", () => {
        it("enqueues a scan for every project and marks them scanning", async () => {
            const projects: ProjectsGateway.Project[] = [
                {
                    id: "p1",
                    name: "one",
                    path: "/tmp/one",
                    pmVersion: "4.1.0",
                    packageManager: "yarn",
                    addedAt: 1000,
                    lastScannedAt: null,
                    hasNodeModules: false
                },
                {
                    id: "p2",
                    name: "two",
                    path: "/tmp/two",
                    pmVersion: "4.1.0",
                    packageManager: "yarn",
                    addedAt: 1500,
                    lastScannedAt: null,
                    hasNodeModules: false
                }
            ];
            getResult = projects;
            const presenter = createPresenter();
            await presenter.load();
            calls = [];

            const pending = presenter.scanAll();

            expect(presenter.vm.projects.every(project => project.scanStatus === "scanning")).toBe(
                true
            );
            expect(presenter.vm.bulkActionRunning).toBe(true);

            await pending;

            expect(calls.filter(c => c.route === scanProjectAsyncRoute).map(c => c.args)).toEqual([
                { params: { id: "p1" }, query: undefined },
                { params: { id: "p2" }, query: undefined }
            ]);
        });

        it("updates per-project scanStatus as scan:progress/scan:complete events arrive", async () => {
            getResult = [
                {
                    id: "p1",
                    name: "one",
                    path: "/tmp/one",
                    pmVersion: "4.1.0",
                    packageManager: "yarn",
                    addedAt: 1000,
                    lastScannedAt: null,
                    hasNodeModules: false
                }
            ];
            const presenter = createPresenter();
            await presenter.load();
            await presenter.scanAll();

            fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 1,
                total: 5
            });
            expect(presenter.vm.projects[0]?.scanStatus).toBe("scanning");

            fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(presenter.vm.projects[0]?.scanStatus).toBe("done");
            expect(presenter.vm.bulkActionRunning).toBe(false);
        });

        it("marks a project as failed on scan:failed", async () => {
            getResult = [
                {
                    id: "p1",
                    name: "one",
                    path: "/tmp/one",
                    pmVersion: "4.1.0",
                    packageManager: "yarn",
                    addedAt: 1000,
                    lastScannedAt: null,
                    hasNodeModules: false
                }
            ];
            const presenter = createPresenter();
            await presenter.load();
            await presenter.scanAll();

            fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });

            expect(presenter.vm.projects[0]?.scanStatus).toBe("failed");
        });

        it("should unsubscribe from all events on dispose", async () => {
            getResult = [
                {
                    id: "p1",
                    name: "one",
                    path: "/tmp/one",
                    pmVersion: "4.1.0",
                    packageManager: "yarn",
                    addedAt: 1000,
                    lastScannedAt: null,
                    hasNodeModules: false
                }
            ];
            const presenter = createPresenter();
            await presenter.load();

            presenter.dispose();

            fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 1,
                total: 5
            });
            fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });
            fakeEventBridge.emit("install:complete", { projectId: "p1" });
            fakeEventBridge.emit("job:status", {
                jobId: "j1",
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "completed"
            });

            expect(presenter.vm.projects[0]?.scanStatus).toBe("idle");
            expect(fakeEventBridge.listenerCount("scan:progress")).toBe(0);
            expect(fakeEventBridge.listenerCount("scan:complete")).toBe(0);
            expect(fakeEventBridge.listenerCount("scan:failed")).toBe(0);
            expect(fakeEventBridge.listenerCount("install:complete")).toBe(0);
            expect(fakeEventBridge.listenerCount("job:status")).toBe(0);
        });
    });

    it("refreshes security for all projects and reloads the list", async () => {
        getResult = [
            {
                id: "p1",
                name: "one",
                path: "/tmp/one",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        await presenter.refreshAllSecurity();

        expect(calls.some(c => c.route === checkProjectSecurityRoute)).toBe(true);
        expect(calls.some(c => c.route === listProjectsRoute)).toBe(true);
        expect(presenter.vm.bulkActionRunning).toBe(false);
    });

    describe("clone and browse", () => {
        it("clone VM fields initialize to defaults", () => {
            const presenter = createPresenter();
            expect(presenter.vm.cloneUrl).toBe("");
            expect(presenter.vm.cloneFolderName).toBe("");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneError).toBeNull();
        });

        it("setCloneUrl auto-derives folder name from https URL", () => {
            const presenter = createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            expect(presenter.vm.cloneUrl).toBe("https://github.com/org/my-repo.git");
            expect(presenter.vm.cloneFolderName).toBe("my-repo");
        });

        it("setCloneUrl auto-derives folder name from URL without .git", () => {
            const presenter = createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo");
            expect(presenter.vm.cloneFolderName).toBe("my-repo");
        });

        it("setCloneFolderName overrides the derived folder name", () => {
            const presenter = createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            presenter.setCloneFolderName("custom-name");
            expect(presenter.vm.cloneFolderName).toBe("custom-name");
        });

        it("browseTo fetches directory listing and updates VM", async () => {
            browseItems = [
                { name: "project-a", path: "/some/path/project-a" },
                { name: "project-b", path: "/some/path/project-b" }
            ];
            const presenter = createPresenter();

            await presenter.browseTo("/some/path");

            expect(presenter.vm.browsePath).toBe("/some/path");
            expect(presenter.vm.browseItems).toEqual(browseItems);
            expect(presenter.vm.browseLoading).toBe(false);
            expect(calls).toEqual([
                {
                    route: browseFilesystemRoute,
                    args: { params: {}, query: { path: "/some/path" } }
                }
            ]);
        });

        it("clones a project, clears the form, and reloads the project list on success", async () => {
            const presenter = createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            calls = [];

            await presenter.cloneProject();

            expect(calls).toEqual([
                {
                    route: cloneProjectRoute,
                    args: {
                        params: {},
                        body: {
                            url: "https://github.com/org/my-repo.git",
                            destination: "",
                            folderName: "my-repo"
                        }
                    }
                },
                { route: listProjectsRoute, args: { params: {} } }
            ]);
            expect(presenter.vm.cloneUrl).toBe("");
            expect(presenter.vm.cloneFolderName).toBe("");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneError).toBeNull();
        });

        it("records an error and keeps the form when cloning fails", async () => {
            const presenter = createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            cloneError = new Error("Repository not found");

            await presenter.cloneProject();

            expect(presenter.vm.cloneError).toBe("Repository not found");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneUrl).toBe("https://github.com/org/my-repo.git");
        });
    });

    describe("search filtering", () => {
        function makeProject(
            overrides: Partial<ProjectsGateway.Project> = {}
        ): ProjectsGateway.Project {
            return {
                id: generateId(),
                name: "my-app",
                path: "/Projects/my-app",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                lastScannedAt: null,
                hasNodeModules: false,
                security: null,
                teams: [],
                addedAt: Date.now(),
                ...overrides
            };
        }

        it("shows all projects when search is empty", async () => {
            getResult = [
                makeProject({ id: "p1", name: "frontend" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            expect(presenter.vm.projects).toHaveLength(2);
            expect(presenter.vm.searchQuery).toBe("");
        });

        it("filters projects by name", async () => {
            getResult = [
                makeProject({ id: "p1", name: "frontend-app" }),
                makeProject({ id: "p2", name: "backend-api" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            presenter.setSearchQuery("frontend");
            expect(presenter.vm.projects).toHaveLength(1);
            expect(presenter.vm.projects[0]!.name).toBe("frontend-app");
        });

        it("filters projects by path", async () => {
            getResult = [
                makeProject({ id: "p1", name: "app", path: "/home/user/web" }),
                makeProject({ id: "p2", name: "lib", path: "/home/user/api" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            presenter.setSearchQuery("/web");
            expect(presenter.vm.projects).toHaveLength(1);
            expect(presenter.vm.projects[0]!.name).toBe("app");
        });

        it("filters projects by package manager", async () => {
            getResult = [
                makeProject({ id: "p1", name: "app-a", packageManager: "yarn" }),
                makeProject({ id: "p2", name: "app-b", packageManager: "pnpm" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            presenter.setSearchQuery("pnpm");
            expect(presenter.vm.projects).toHaveLength(1);
            expect(presenter.vm.projects[0]!.name).toBe("app-b");
        });

        it("search is case-insensitive", async () => {
            getResult = [
                makeProject({ id: "p1", name: "Frontend-App" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            presenter.setSearchQuery("FRONTEND");
            expect(presenter.vm.projects).toHaveLength(1);
            expect(presenter.vm.projects[0]!.name).toBe("Frontend-App");
        });

        it("clearing search restores all projects", async () => {
            getResult = [
                makeProject({ id: "p1", name: "frontend" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = createPresenter();
            await presenter.load();
            presenter.setSearchQuery("frontend");
            expect(presenter.vm.projects).toHaveLength(1);
            presenter.setSearchQuery("");
            expect(presenter.vm.projects).toHaveLength(2);
        });
    });
});
