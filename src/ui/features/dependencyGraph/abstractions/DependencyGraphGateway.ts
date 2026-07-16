import { createAbstraction } from "#shared/index.js";

export interface IDependencyGraphEdge {
    parentPackage: string | null;
    parentVersion: string | null;
    childPackage: string;
    childVersion: string;
    dependencyType: string;
    depth: number;
}

export interface IDependencyGraph {
    edges: IDependencyGraphEdge[];
    rootPackages: string[];
    totalPackages: number;
    maxDepth: number;
    edgeCount: number;
}

export interface IDependencyPathNode {
    packageName: string;
    version: string;
}

export interface IDependencyPath {
    target: string;
    chain: IDependencyPathNode[];
}

export interface IDependencyGraphStats {
    totalPackages: number;
    maxDepth: number;
    rootCount: number;
    edgeCount: number;
}

export interface IRefreshDependencyGraphResult {
    edgeCount: number;
}

export interface ISearchPackagesParams {
    projectId: string;
    query: string;
    limit?: number;
}

export interface IFindPathsParams {
    projectId: string;
    packageName: string;
}

export interface IDependencyGraphGateway {
    getGraph(projectId: string): Promise<IDependencyGraph>;
    findPaths(params: IFindPathsParams): Promise<IDependencyPath[]>;
    searchPackages(params: ISearchPackagesParams): Promise<string[]>;
    getStats(projectId: string): Promise<IDependencyGraphStats>;
    refresh(projectId: string): Promise<IRefreshDependencyGraphResult>;
}

export const DependencyGraphGateway = createAbstraction<IDependencyGraphGateway>(
    "Ui/DependencyGraphGateway"
);

export namespace DependencyGraphGateway {
    export type Interface = IDependencyGraphGateway;
    export type Edge = IDependencyGraphEdge;
    export type Graph = IDependencyGraph;
    export type PathNode = IDependencyPathNode;
    export type Path = IDependencyPath;
    export type Stats = IDependencyGraphStats;
    export type RefreshResult = IRefreshDependencyGraphResult;
    export type SearchPackagesParams = ISearchPackagesParams;
    export type FindPathsParams = IFindPathsParams;
}
