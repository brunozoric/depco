import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { DependencyGraphGateway as DependencyGraphGatewayAbstraction } from "../../../features/DependencyGraph/abstractions/DependencyGraphGateway.js";
import type { DependencyGraphGateway } from "../../../features/DependencyGraph/abstractions/DependencyGraphGateway.js";
import { DependencyGraphRepository as DependencyGraphRepositoryRegistration } from "../../../features/DependencyGraph/DependencyGraphRepository.js";
import { LoadDependencyGraphUseCase as LoadDependencyGraphUseCaseRegistration } from "../useCases/LoadDependencyGraphUseCase.js";
import { RefreshDependencyGraphUseCase as RefreshDependencyGraphUseCaseRegistration } from "../useCases/RefreshDependencyGraphUseCase.js";
import { DependencyGraphPresenter } from "../GraphPage/abstractions/DependencyGraphPresenter.js";
import { DependencyGraphPresenter as DependencyGraphPresenterRegistration } from "../GraphPage/DependencyGraphPresenter.js";
import { EventBridge } from "../../../events/abstractions/EventBridge.js";
import "../../../events/eventMap.js";

interface MockEventBridge {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
}

interface RecordedGatewayCall {
    method: string;
    args: unknown;
}

interface MockGatewayState {
    graph: DependencyGraphGateway.Graph;
    stats: DependencyGraphGateway.Stats;
    pathsByPackage: Record<string, DependencyGraphGateway.Path[]>;
    suggestionsByQuery: Record<string, string[]>;
}

interface MockGatewayHandle {
    gateway: DependencyGraphGateway.Interface;
    state: MockGatewayState;
    calls: RecordedGatewayCall[];
}

function defaultGraph(): DependencyGraphGateway.Graph {
    return {
        edges: [
            {
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.21",
                dependencyType: "prod",
                depth: 0
            }
        ],
        rootPackages: ["lodash"],
        totalPackages: 1,
        maxDepth: 0,
        edgeCount: 1
    };
}

function defaultStats(): DependencyGraphGateway.Stats {
    return { totalPackages: 1, maxDepth: 0, rootCount: 1, edgeCount: 1 };
}

function createMockGateway(initial?: Partial<MockGatewayState>): MockGatewayHandle {
    const state: MockGatewayState = {
        graph: initial?.graph ?? defaultGraph(),
        stats: initial?.stats ?? defaultStats(),
        pathsByPackage: initial?.pathsByPackage ?? {},
        suggestionsByQuery: initial?.suggestionsByQuery ?? {}
    };
    const calls: RecordedGatewayCall[] = [];

    const gateway: DependencyGraphGateway.Interface = {
        getGraph: async projectId => {
            calls.push({ method: "getGraph", args: projectId });
            return state.graph;
        },
        findPaths: async params => {
            calls.push({ method: "findPaths", args: params });
            return state.pathsByPackage[params.packageName] ?? [];
        },
        searchPackages: async params => {
            calls.push({ method: "searchPackages", args: params });
            return state.suggestionsByQuery[params.query] ?? [];
        },
        getStats: async projectId => {
            calls.push({ method: "getStats", args: projectId });
            return state.stats;
        },
        refresh: async projectId => {
            calls.push({ method: "refresh", args: projectId });
            return { edgeCount: state.graph.edgeCount };
        }
    };

    return { gateway, state, calls };
}

interface CreatedPresenter {
    presenter: DependencyGraphPresenter.Interface;
    eventBridgeMock: MockEventBridge;
}

function createPresenter(mockGateway: MockGatewayHandle): CreatedPresenter {
    const container = createContainer();

    const eventBridgeMock: MockEventBridge = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    };

    container.registerInstance(DependencyGraphGatewayAbstraction, mockGateway.gateway);
    container.register(DependencyGraphRepositoryRegistration).inSingletonScope();
    container.register(LoadDependencyGraphUseCaseRegistration);
    container.register(RefreshDependencyGraphUseCaseRegistration);
    container.registerInstance(EventBridge, eventBridgeMock as unknown as EventBridge.Interface);
    container.register(DependencyGraphPresenterRegistration);

    return { presenter: container.resolve(DependencyGraphPresenter), eventBridgeMock };
}

describe("DependencyGraphPresenter", () => {
    describe("initial state", () => {
        it("starts with loading true and empty collections before load resolves", () => {
            const { presenter } = createPresenter(createMockGateway());

            expect(presenter.vm.loading).toBe(true);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.edges).toEqual([]);
            expect(presenter.vm.paths).toEqual([]);
            expect(presenter.vm.stats).toBeNull();
            expect(presenter.vm.searchQuery).toBe("");
            expect(presenter.vm.viewMode).toBe("tree");
            expect(presenter.vm.selectedPackage).toBeNull();
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(presenter.vm.searchMode).toBe("dim");
            expect(presenter.vm.filters).toEqual({ dependencyKind: null, maxDepth: null });
            expect(presenter.vm.showSuggestions).toBe(false);
        });
    });

    describe("after load", () => {
        it("populates stats and edges once the graph and stats resolve", async () => {
            const mockGateway = createMockGateway();
            const { presenter } = createPresenter(mockGateway);

            await presenter.load("project-1");

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.stats).toEqual({
                totalPackages: 1,
                maxDepth: 0,
                rootCount: 1,
                edgeCount: 1
            });
            expect(presenter.vm.edges).toEqual([
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "lodash",
                    childVersion: "4.17.21",
                    dependencyType: "prod",
                    depth: 0
                }
            ]);
        });
    });

    describe("search", () => {
        it("populates paths for a matching package", async () => {
            const mockGateway = createMockGateway({
                pathsByPackage: {
                    "left-pad": [
                        {
                            target: "left-pad",
                            chain: [
                                { packageName: "lodash", version: "4.17.21" },
                                { packageName: "left-pad", version: "1.3.0" }
                            ]
                        }
                    ]
                }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");

            await presenter.search("left-pad");

            expect(presenter.vm.searchQuery).toBe("left-pad");
            expect(presenter.vm.paths).toEqual([
                {
                    target: "left-pad",
                    chain: [
                        { packageName: "lodash", version: "4.17.21" },
                        { packageName: "left-pad", version: "1.3.0" }
                    ]
                }
            ]);
        });

        it("clears paths when searching for an unknown package", async () => {
            const { presenter } = createPresenter(createMockGateway());
            await presenter.load("project-1");

            await presenter.search("unknown-package");

            expect(presenter.vm.searchQuery).toBe("unknown-package");
            expect(presenter.vm.paths).toEqual([]);
        });
    });

    describe("setSearchQuery", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("debounces autocomplete and populates suggestions via the gateway after 300ms", async () => {
            const mockGateway = createMockGateway({
                suggestionsByQuery: {
                    lod: ["lodash", "lodash.merge"]
                }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            presenter.setSearchQuery("lod");

            expect(presenter.vm.searchQuery).toBe("lod");
            expect(presenter.vm.showSuggestions).toBe(true);
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(mockGateway.calls).toEqual([]);

            await vi.advanceTimersByTimeAsync(300);

            expect(mockGateway.calls).toEqual([
                { method: "searchPackages", args: { projectId: "project-1", query: "lod" } }
            ]);
            expect(presenter.vm.searchSuggestions).toEqual(["lodash", "lodash.merge"]);
        });

        it("does not fire a new search request before the debounce window elapses", async () => {
            const mockGateway = createMockGateway({
                suggestionsByQuery: { lod: ["lodash"] }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            presenter.setSearchQuery("l");
            await vi.advanceTimersByTimeAsync(100);
            presenter.setSearchQuery("lod");
            await vi.advanceTimersByTimeAsync(100);

            expect(mockGateway.calls).toEqual([]);

            await vi.advanceTimersByTimeAsync(200);

            expect(mockGateway.calls).toEqual([
                { method: "searchPackages", args: { projectId: "project-1", query: "lod" } }
            ]);
        });

        it("clears suggestions and paths immediately when the query is emptied", async () => {
            const { presenter } = createPresenter(createMockGateway());
            await presenter.load("project-1");

            presenter.setSearchQuery("");

            expect(presenter.vm.searchQuery).toBe("");
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(presenter.vm.showSuggestions).toBe(false);
            expect(presenter.vm.paths).toEqual([]);
        });
    });

    describe("selectSuggestion", () => {
        it("fires findPaths for the selected package and clears suggestions", async () => {
            const mockGateway = createMockGateway({
                pathsByPackage: {
                    lodash: [
                        { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
                    ]
                }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            presenter.setSearchQuery("lod");
            mockGateway.calls.length = 0;

            presenter.selectSuggestion("lodash");
            await Promise.resolve();
            await Promise.resolve();

            expect(presenter.vm.searchQuery).toBe("lodash");
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(presenter.vm.showSuggestions).toBe(false);
            expect(mockGateway.calls).toEqual([
                { method: "findPaths", args: { projectId: "project-1", packageName: "lodash" } }
            ]);
            expect(presenter.vm.paths).toEqual([
                { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
            ]);
        });

        it("cancels a pending autocomplete timer so stale suggestions can't overwrite state", async () => {
            vi.useFakeTimers();
            try {
                const mockGateway = createMockGateway({
                    suggestionsByQuery: { lod: ["lodash", "lodash.merge"] },
                    pathsByPackage: {
                        lodash: [
                            {
                                target: "lodash",
                                chain: [{ packageName: "lodash", version: "4.17.21" }]
                            }
                        ]
                    }
                });
                const { presenter } = createPresenter(mockGateway);
                await presenter.load("project-1");
                mockGateway.calls.length = 0;

                presenter.setSearchQuery("lod");
                presenter.selectSuggestion("lodash");
                await vi.advanceTimersByTimeAsync(300);

                expect(mockGateway.calls.some(call => call.method === "searchPackages")).toBe(
                    false
                );
                expect(presenter.vm.searchSuggestions).toEqual([]);
                expect(presenter.vm.showSuggestions).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("setSearchMode", () => {
        it("toggles between dim and matchesOnly", () => {
            const { presenter } = createPresenter(createMockGateway());

            expect(presenter.vm.searchMode).toBe("dim");

            presenter.setSearchMode("matchesOnly");
            expect(presenter.vm.searchMode).toBe("matchesOnly");

            presenter.setSearchMode("dim");
            expect(presenter.vm.searchMode).toBe("dim");
        });
    });

    describe("setFilter", () => {
        it("updates the dependencyKind filter", () => {
            const { presenter } = createPresenter(createMockGateway());

            presenter.setFilter({ field: "dependencyKind", value: "dev" });
            expect(presenter.vm.filters).toEqual({ dependencyKind: "dev", maxDepth: null });

            presenter.setFilter({ field: "dependencyKind", value: null });
            expect(presenter.vm.filters).toEqual({ dependencyKind: null, maxDepth: null });
        });

        it("updates the maxDepth filter", () => {
            const { presenter } = createPresenter(createMockGateway());

            presenter.setFilter({ field: "maxDepth", value: 3 });
            expect(presenter.vm.filters).toEqual({ dependencyKind: null, maxDepth: 3 });

            presenter.setFilter({ field: "maxDepth", value: null });
            expect(presenter.vm.filters).toEqual({ dependencyKind: null, maxDepth: null });
        });
    });

    describe("closeSuggestions", () => {
        it("hides suggestions but preserves the search query and paths", async () => {
            const mockGateway = createMockGateway({
                pathsByPackage: {
                    lodash: [
                        { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
                    ]
                }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            await presenter.search("lodash");
            presenter.setSearchQuery("lod");

            presenter.closeSuggestions();

            expect(presenter.vm.searchQuery).toBe("lod");
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(presenter.vm.showSuggestions).toBe(false);
            expect(presenter.vm.paths).toEqual([
                { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
            ]);
        });

        it("cancels a pending autocomplete timer", async () => {
            vi.useFakeTimers();
            try {
                const mockGateway = createMockGateway({
                    suggestionsByQuery: { lod: ["lodash"] }
                });
                const { presenter } = createPresenter(mockGateway);
                await presenter.load("project-1");
                mockGateway.calls.length = 0;

                presenter.setSearchQuery("lod");
                presenter.closeSuggestions();
                await vi.advanceTimersByTimeAsync(300);

                expect(mockGateway.calls.some(call => call.method === "searchPackages")).toBe(
                    false
                );
                expect(presenter.vm.searchSuggestions).toEqual([]);
                expect(presenter.vm.showSuggestions).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("clearSearch", () => {
        it("resets query, suggestions, paths, and showSuggestions", async () => {
            const mockGateway = createMockGateway({
                pathsByPackage: {
                    lodash: [
                        { target: "lodash", chain: [{ packageName: "lodash", version: "4.17.21" }] }
                    ]
                }
            });
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            await presenter.search("lodash");
            presenter.setSearchQuery("lod");

            presenter.clearSearch();

            expect(presenter.vm.searchQuery).toBe("");
            expect(presenter.vm.searchSuggestions).toEqual([]);
            expect(presenter.vm.showSuggestions).toBe(false);
            expect(presenter.vm.paths).toEqual([]);
        });

        it("cancels a pending autocomplete timer so stale suggestions can't overwrite state", async () => {
            vi.useFakeTimers();
            try {
                const mockGateway = createMockGateway({
                    suggestionsByQuery: { lod: ["lodash", "lodash.merge"] }
                });
                const { presenter } = createPresenter(mockGateway);
                await presenter.load("project-1");
                mockGateway.calls.length = 0;

                presenter.setSearchQuery("lod");
                presenter.clearSearch();
                await vi.advanceTimersByTimeAsync(300);

                expect(mockGateway.calls.some(call => call.method === "searchPackages")).toBe(
                    false
                );
                expect(presenter.vm.searchSuggestions).toEqual([]);
                expect(presenter.vm.showSuggestions).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("view mode", () => {
        it("toggles between tree and graph", () => {
            const { presenter } = createPresenter(createMockGateway());

            expect(presenter.vm.viewMode).toBe("tree");

            presenter.setViewMode("graph");
            expect(presenter.vm.viewMode).toBe("graph");

            presenter.setViewMode("tree");
            expect(presenter.vm.viewMode).toBe("tree");
        });
    });

    describe("refresh", () => {
        it("triggers a gateway refresh and re-fetches the graph and stats", async () => {
            const mockGateway = createMockGateway();
            const { presenter } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            await presenter.refresh();

            expect(mockGateway.calls.map(call => call.method)).toEqual([
                "refresh",
                "getGraph",
                "getStats"
            ]);
            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.error).toBeNull();
        });
    });

    describe("selectPackage", () => {
        it("updates the selected package", () => {
            const { presenter } = createPresenter(createMockGateway());

            expect(presenter.vm.selectedPackage).toBeNull();

            presenter.selectPackage("lodash");
            expect(presenter.vm.selectedPackage).toBe("lodash");

            presenter.selectPackage(null);
            expect(presenter.vm.selectedPackage).toBeNull();
        });
    });

    describe("websocket subscriptions", () => {
        function findHandler(
            eventBridgeMock: MockEventBridge,
            eventType: string
        ): (data: unknown) => void {
            const call = eventBridgeMock.on.mock.calls.find((c: unknown[]) => c[0] === eventType);
            if (!call) {
                throw new Error(`No subscription found for event "${eventType}"`);
            }
            return call[1] as (data: unknown) => void;
        }

        it("reloads the graph when scan:complete fires for the current project", async () => {
            const mockGateway = createMockGateway();
            const { presenter, eventBridgeMock } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            const handleScanComplete = findHandler(eventBridgeMock, "scan:complete");
            handleScanComplete({ projectId: "project-1", warning: null });
            await Promise.resolve();
            await Promise.resolve();

            expect(mockGateway.calls.map(call => call.method)).toEqual(["getGraph", "getStats"]);
        });

        it("ignores scan:complete for a different project", async () => {
            const mockGateway = createMockGateway();
            const { presenter, eventBridgeMock } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            const handleScanComplete = findHandler(eventBridgeMock, "scan:complete");
            handleScanComplete({ projectId: "other-project", warning: null });
            await Promise.resolve();
            await Promise.resolve();

            expect(mockGateway.calls).toEqual([]);
        });

        it("reloads the graph when transitive-resolve:complete fires for the current project", async () => {
            const mockGateway = createMockGateway();
            const { presenter, eventBridgeMock } = createPresenter(mockGateway);
            await presenter.load("project-1");
            mockGateway.calls.length = 0;

            const handleTransitiveResolveComplete = findHandler(
                eventBridgeMock,
                "transitive-resolve:complete"
            );
            handleTransitiveResolveComplete({ projectId: "project-1", resolved: 3 });
            await Promise.resolve();
            await Promise.resolve();

            expect(mockGateway.calls.map(call => call.method)).toEqual(["getGraph", "getStats"]);
        });
    });
});
