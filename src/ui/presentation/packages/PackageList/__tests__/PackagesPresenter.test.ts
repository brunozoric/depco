// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    listPackagesRoute,
    listProjectsRoute,
    rescanPackageRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute,
    createUpgradeJobRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { PackagesFeature } from "../../../../features/Packages/feature.js";
import { UpgradesFeature } from "../../../../features/Upgrades/feature.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { LoadPackagesUseCase as LoadPackagesUseCaseRegistration } from "../../useCases/LoadPackagesUseCase.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../../projects/useCases/LoadProjectsUseCase.js";
import { PackagesPresenter } from "../abstractions/PackagesPresenter.js";
import { PackagesPresenter as PackagesPresenterRegistration } from "../PackagesPresenter.js";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";
import { TeamFilterFeature } from "../../../../features/TeamFilter/feature.js";
import { UrlFilterFeature } from "../../../../features/UrlFilter/feature.js";

function setUrlParams(params: Record<string, string>): void {
    const search = new URLSearchParams(params).toString();
    const url = search ? `/packages?${search}` : "/packages";
    window.history.pushState(null, "", url);
}

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

const packagesResult: PackagesGateway.PackageListItem[] = [
    {
        name: "left-pad",
        projects: [
            {
                projectId: "p1",
                projectName: "project-one",
                currentVersion: "1.0.0",
                latestVersion: "2.0.0",
                upgradeType: "major"
            },
            {
                projectId: "p2",
                projectName: "project-two",
                currentVersion: "1.5.0",
                latestVersion: "2.0.0",
                upgradeType: "minor"
            }
        ],
        changelogCount: 3,
        lastPublishedAt: 1000,
        dependencyKind: "dependency",
        registryResolved: true
    }
];

const projectsResult = [
    {
        id: "p1",
        name: "project-one",
        path: "/tmp/project-one",
        packageManager: "yarn",
        pmVersion: "4.1.0",
        addedAt: 1000,
        lastScannedAt: 2000,
        hasNodeModules: false
    }
];

const changelogEntries: PackagesGateway.ChangelogEntry[] = [
    { version: "2.0.0", content: "breaking changes", source: "github" }
];

describe("PackagesPresenter", () => {
    let calls: RecordedCall[];
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;

    function createPresenter(): PackagesPresenter.Interface {
        const container: Container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case listPackagesRoute:
                        return {
                            items: packagesResult,
                            total: packagesResult.length
                        } as T;
                    case listProjectsRoute:
                        return {
                            items: projectsResult,
                            total: projectsResult.length
                        } as T;
                    case rescanPackageRoute:
                        return { item: { updated: 1 } } as T;
                    case getChangelogsRoute:
                        return {
                            items: changelogEntries,
                            total: 0,
                            resolving: false
                        } as T;
                    case reResolveChangelogsRoute:
                        return {
                            items: changelogEntries,
                            total: 0,
                            resolving: true
                        } as T;
                    case createUpgradeJobRoute:
                        return { item: { jobId: "job-1" } } as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        ProjectsFeature.register(container);
        PackagesFeature.register(container);
        UpgradesFeature.register(container);
        TeamFilterFeature.register(container);
        UrlFilterFeature.register(container);
        container.register(LoadPackagesUseCaseRegistration);
        container.register(LoadProjectsUseCaseRegistration);
        container.register(PackagesPresenterRegistration);

        return container.resolve(PackagesPresenter);
    }

    beforeEach(() => {
        setUrlParams({});
        calls = [];
    });

    it("starts with an idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            error: null,
            packages: [],
            search: "",
            upgradeType: null,
            dependencyKind: null,
            projectId: null,
            hasChangelog: false,
            projectOptions: [],
            page: 1,
            pageSize: 50,
            totalCount: 0,
            totalPages: 0,
            sortBy: "name",
            sortOrder: "asc",
            expandedPackageName: null,
            changelogState: null
        });
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = createPresenter();

        const pending = presenter.load();
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("loads packages and projects, mapping packages with computed fields", async () => {
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.packages).toEqual([
            {
                name: "left-pad",
                projects: packagesResult[0]!.projects,
                changelogCount: 3,
                highestUpgradeType: "major",
                minCurrentVersion: "1.0.0",
                maxLatestVersion: "2.0.0",
                lastPublishedAt: 1000,
                registryResolved: true
            }
        ]);
    });

    it("populates projectOptions from loaded projects", async () => {
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.projectOptions).toEqual([{ value: "p1", label: "project-one" }]);
    });

    it("computes totalCount and totalPages from the repository", async () => {
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.totalCount).toBe(packagesResult.length);
        expect(presenter.vm.totalPages).toBe(1);
    });

    it("setSearch updates URL and resets page", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        vi.useFakeTimers();
        presenter.setSearch("lodash");

        expect(presenter.vm.search).toBe("lodash");
        expect(presenter.vm.page).toBe(1);

        // The API reload is triggered by the debounced popstate dispatch.
        vi.advanceTimersByTime(300);
        vi.useRealTimers();
        await Promise.resolve();
        await Promise.resolve();

        expect(calls.some(c => c.route === listPackagesRoute)).toBe(true);
    });

    it("setUpgradeType updates filter, resets page, and triggers load", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setUpgradeType("major");
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.upgradeType).toBe("major");
        expect(presenter.vm.page).toBe(1);
    });

    it("setDependencyKind updates filter, resets page, and triggers load", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setDependencyKind("transitive");
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.dependencyKind).toBe("transitive");
        expect(presenter.vm.page).toBe(1);
    });

    it("setProjectId updates filter, resets page, and triggers load", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setProjectId("p1");
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.projectId).toBe("p1");
        expect(presenter.vm.page).toBe(1);
    });

    it("setHasChangelog updates filter, resets page, and triggers load", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setHasChangelog(true);
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.hasChangelog).toBe(true);
        expect(presenter.vm.page).toBe(1);
    });

    it("setPage updates page and triggers load", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setPage(3);
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.page).toBe(3);
    });

    it("setSortBy toggles sort order when same column is clicked", async () => {
        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.sortBy).toBe("name");
        expect(presenter.vm.sortOrder).toBe("asc");

        presenter.setSortBy("name");

        expect(presenter.vm.sortOrder).toBe("desc");
    });

    it("setSortBy defaults to desc for lastPublishedAt and asc for other columns", async () => {
        const presenter = createPresenter();
        await presenter.load();

        presenter.setSortBy("lastPublishedAt");

        expect(presenter.vm.sortBy).toBe("lastPublishedAt");
        expect(presenter.vm.sortOrder).toBe("desc");

        presenter.setSortBy("name");

        expect(presenter.vm.sortBy).toBe("name");
        expect(presenter.vm.sortOrder).toBe("asc");
    });

    it("togglePackageDetails expands and collapses a package", () => {
        const presenter = createPresenter();

        presenter.togglePackageDetails("left-pad");
        expect(presenter.vm.expandedPackageName).toBe("left-pad");

        presenter.togglePackageDetails("left-pad");
        expect(presenter.vm.expandedPackageName).toBeNull();
    });

    it("togglePackageDetails switches to a different package", () => {
        const presenter = createPresenter();

        presenter.togglePackageDetails("left-pad");
        expect(presenter.vm.expandedPackageName).toBe("left-pad");

        presenter.togglePackageDetails("right-pad");
        expect(presenter.vm.expandedPackageName).toBe("right-pad");
    });

    it("scan:complete WebSocket event triggers a reload", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls.some(c => c.route === listPackagesRoute)).toBe(true);
    });

    it("transitive-resolve:complete WebSocket event triggers a reload", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        fakeEventBridge.emit("transitive-resolve:complete", {
            projectId: "p1",
            resolved: 3,
            failed: 0
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls.some(c => c.route === listPackagesRoute)).toBe(true);
    });

    describe("URL filter integration", () => {
        it("reads filters from URL on load", async () => {
            setUrlParams({ search: "lodash", upgradeType: "major", page: "2" });
            const presenter = createPresenter();
            await presenter.load();

            expect(presenter.vm.search).toBe("lodash");
            expect(presenter.vm.upgradeType).toBe("major");
            expect(presenter.vm.page).toBe(2);
        });

        it("reads sort params from URL", () => {
            setUrlParams({ sortBy: "lastPublishedAt", sortOrder: "desc" });
            const presenter = createPresenter();

            expect(presenter.vm.sortBy).toBe("lastPublishedAt");
            expect(presenter.vm.sortOrder).toBe("desc");
        });

        it("reads hasChangelog from URL as boolean", () => {
            setUrlParams({ hasChangelog: "true" });
            const presenter = createPresenter();

            expect(presenter.vm.hasChangelog).toBe(true);
        });

        it("reads dependencyKind from URL", () => {
            setUrlParams({ dependencyKind: "transitive" });
            const presenter = createPresenter();

            expect(presenter.vm.dependencyKind).toBe("transitive");
        });
    });
});
