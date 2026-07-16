import { computed, makeAutoObservable, runInAction } from "mobx";
import { DependencyGraphPresenter as Abstraction } from "./abstractions/DependencyGraphPresenter.js";
import { LoadDependencyGraphUseCase } from "../useCases/abstractions/LoadDependencyGraphUseCase.js";
import { RefreshDependencyGraphUseCase } from "../useCases/abstractions/RefreshDependencyGraphUseCase.js";
import { DependencyGraphRepository } from "../../../features/dependencyGraph/abstractions/DependencyGraphRepository.js";
import { DependencyGraphGateway } from "../../../features/dependencyGraph/abstractions/DependencyGraphGateway.js";
import { EventBridge } from "../../../events/abstractions/EventBridge.js";
import "../../../events/eventMap.js";

class DependencyGraphPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private searchQuery = "";
    private viewMode: Abstraction.ViewMode = "tree";
    private selectedPackage: string | null = null;
    private projectId: string | null = null;
    private searchSuggestions: string[] = [];
    private searchMode: Abstraction.SearchMode = "dim";
    private filterDependencyKind: string | null = null;
    private filterMaxDepth: number | null = null;
    private showSuggestions = false;
    private autocompleteTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly handleScanComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleTransitiveResolveComplete: EventBridge.Callback<"transitive-resolve:complete">;

    public constructor(
        private readonly loadDependencyGraphUseCase: LoadDependencyGraphUseCase.Interface,
        private readonly refreshDependencyGraphUseCase: RefreshDependencyGraphUseCase.Interface,
        private readonly repository: DependencyGraphRepository.Interface,
        private readonly gateway: DependencyGraphGateway.Interface,
        private readonly eventBridge: EventBridge.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleScanComplete = data => {
            if (data.projectId === this.projectId) {
                void this.load(data.projectId);
            }
        };

        this.handleTransitiveResolveComplete = data => {
            if (data.projectId === this.projectId) {
                void this.load(data.projectId);
            }
        };

        this.eventBridge.on("scan:complete", this.handleScanComplete);
        this.eventBridge.on("transitive-resolve:complete", this.handleTransitiveResolveComplete);
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            edges: this.buildEdges(),
            paths: this.buildPaths(),
            stats: this.buildStats(),
            searchQuery: this.searchQuery,
            viewMode: this.viewMode,
            selectedPackage: this.selectedPackage,
            searchSuggestions: this.searchSuggestions,
            searchMode: this.searchMode,
            filters: {
                dependencyKind: this.filterDependencyKind,
                maxDepth: this.filterMaxDepth
            },
            showSuggestions: this.showSuggestions
        };
    }

    public load = async (projectId: string): Promise<void> => {
        this.projectId = projectId;
        this.loading = true;
        this.error = null;
        try {
            await this.loadDependencyGraphUseCase.execute(projectId);
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load dependency graph";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public search = async (packageName: string): Promise<void> => {
        this.searchQuery = packageName;

        if (!this.projectId) {
            return;
        }

        if (packageName.trim() === "") {
            runInAction(() => {
                this.repository.setPaths([]);
            });
            return;
        }

        try {
            const paths = await this.gateway.findPaths({
                projectId: this.projectId,
                packageName
            });
            runInAction(() => {
                this.repository.setPaths(paths);
            });
        } catch (err) {
            runInAction(() => {
                this.error =
                    err instanceof Error ? err.message : "Failed to search dependency paths";
            });
        }
    };

    public setSearchQuery = (query: string): void => {
        this.searchQuery = query;

        this.clearAutocompleteTimer();

        if (query.trim() === "") {
            this.searchSuggestions = [];
            this.showSuggestions = false;
            runInAction(() => {
                this.repository.setPaths([]);
            });
            return;
        }

        this.showSuggestions = true;
        this.autocompleteTimer = setTimeout(() => {
            void this.loadSuggestions(query);
        }, 300);
    };

    private loadSuggestions = async (query: string): Promise<void> => {
        if (!this.projectId) {
            return;
        }

        try {
            const suggestions = await this.gateway.searchPackages({
                projectId: this.projectId,
                query
            });
            runInAction(() => {
                this.searchSuggestions = suggestions;
            });
        } catch {
            runInAction(() => {
                this.searchSuggestions = [];
            });
        }
    };

    public selectSuggestion = (packageName: string): void => {
        this.clearAutocompleteTimer();
        this.searchQuery = packageName;
        this.searchSuggestions = [];
        this.showSuggestions = false;
        void this.search(packageName);
    };

    public setSearchMode = (mode: Abstraction.SearchMode): void => {
        this.searchMode = mode;
    };

    public setFilter = (params: { field: string; value: string | number | null }): void => {
        switch (params.field) {
            case "dependencyKind":
                this.filterDependencyKind = params.value as string | null;
                break;
            case "maxDepth":
                this.filterMaxDepth = params.value as number | null;
                break;
        }
    };

    public closeSuggestions = (): void => {
        this.clearAutocompleteTimer();
        this.searchSuggestions = [];
        this.showSuggestions = false;
    };

    public clearSearch = (): void => {
        this.clearAutocompleteTimer();
        this.searchQuery = "";
        this.searchSuggestions = [];
        this.showSuggestions = false;
        this.repository.setPaths([]);
    };

    public setViewMode = (mode: Abstraction.ViewMode): void => {
        this.viewMode = mode;
    };

    public refresh = async (): Promise<void> => {
        if (!this.projectId) {
            return;
        }

        this.loading = true;
        this.error = null;
        try {
            await this.refreshDependencyGraphUseCase.execute(this.projectId);
        } catch (err) {
            runInAction(() => {
                this.error =
                    err instanceof Error ? err.message : "Failed to refresh dependency graph";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public selectPackage = (packageName: string | null): void => {
        this.selectedPackage = packageName;
    };

    private buildEdges(): Abstraction.Edge[] {
        const graph = this.repository.getGraph();
        if (!graph) {
            return [];
        }

        return graph.edges.map((edge): Abstraction.Edge => ({
            parentPackage: edge.parentPackage,
            parentVersion: edge.parentVersion,
            childPackage: edge.childPackage,
            childVersion: edge.childVersion,
            dependencyType: edge.dependencyType,
            depth: edge.depth
        }));
    }

    private buildPaths(): Abstraction.Path[] {
        return this.repository.getPaths().map((path): Abstraction.Path => ({
            target: path.target,
            chain: path.chain.map((node): Abstraction.PathNode => ({
                packageName: node.packageName,
                version: node.version
            }))
        }));
    }

    public dispose = (): void => {
        this.clearAutocompleteTimer();
        this.eventBridge.off("scan:complete", this.handleScanComplete);
        this.eventBridge.off("transitive-resolve:complete", this.handleTransitiveResolveComplete);
    };

    private clearAutocompleteTimer(): void {
        if (this.autocompleteTimer) {
            clearTimeout(this.autocompleteTimer);
            this.autocompleteTimer = null;
        }
    }

    private buildStats(): Abstraction.Stats | null {
        const stats = this.repository.getStats();
        if (!stats) {
            return null;
        }

        return {
            totalPackages: stats.totalPackages,
            maxDepth: stats.maxDepth,
            rootCount: stats.rootCount,
            edgeCount: stats.edgeCount
        };
    }
}

export const DependencyGraphPresenter = Abstraction.createImplementation({
    implementation: DependencyGraphPresenterImpl,
    dependencies: [
        LoadDependencyGraphUseCase,
        RefreshDependencyGraphUseCase,
        DependencyGraphRepository,
        DependencyGraphGateway,
        EventBridge
    ]
});
