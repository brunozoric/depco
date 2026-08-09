import { createAbstraction } from "#shared/index.js";

export interface IDependencyGraphEdgeViewModel {
    parentPackage: string | null;
    parentVersion: string | null;
    childPackage: string;
    childVersion: string;
    dependencyType: string;
    depth: number;
}

export interface IDependencyPathNodeViewModel {
    packageName: string;
    version: string;
}

export interface IDependencyPathViewModel {
    target: string;
    chain: IDependencyPathNodeViewModel[];
}

export interface IDependencyGraphStatsViewModel {
    totalPackages: number;
    maxDepth: number;
    rootCount: number;
    edgeCount: number;
}

export type DependencyGraphViewMode = "tree" | "graph";

export type DependencyGraphSearchMode = "dim" | "matchesOnly";

export interface IDependencyGraphFilters {
    dependencyKind: string | null;
    maxDepth: number | null;
}

export interface IDependencyGraphViewModel {
    loading: boolean;
    error: string | null;
    edges: IDependencyGraphEdgeViewModel[];
    paths: IDependencyPathViewModel[];
    stats: IDependencyGraphStatsViewModel | null;
    searchQuery: string;
    viewMode: DependencyGraphViewMode;
    selectedPackage: string | null;
    searchSuggestions: string[];
    searchMode: DependencyGraphSearchMode;
    filters: IDependencyGraphFilters;
    showSuggestions: boolean;
}

export interface IDependencyGraphPresenter {
    get vm(): IDependencyGraphViewModel;
    load(projectId: string): Promise<void>;
    search(packageName: string): Promise<void>;
    setSearchQuery(query: string): void;
    selectSuggestion(packageName: string): void;
    setSearchMode(mode: DependencyGraphSearchMode): void;
    setFilter(params: { field: string; value: string | number | null }): void;
    closeSuggestions(): void;
    clearSearch(): void;
    setViewMode(mode: DependencyGraphViewMode): void;
    refresh(): Promise<void>;
    selectPackage(packageName: string | null): void;
    dispose(): void;
}

export const DependencyGraphPresenter = createAbstraction<IDependencyGraphPresenter>(
    "Ui/DependencyGraphPresenter"
);

export namespace DependencyGraphPresenter {
    export type Interface = IDependencyGraphPresenter;
    export type ViewModel = IDependencyGraphViewModel;
    export type ViewMode = DependencyGraphViewMode;
    export type Edge = IDependencyGraphEdgeViewModel;
    export type PathNode = IDependencyPathNodeViewModel;
    export type Path = IDependencyPathViewModel;
    export type Stats = IDependencyGraphStatsViewModel;
    export type SearchMode = DependencyGraphSearchMode;
    export type Filters = IDependencyGraphFilters;
}
