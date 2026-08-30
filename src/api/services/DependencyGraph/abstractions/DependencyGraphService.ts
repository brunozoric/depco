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

export interface ISearchPackagesParams {
    projectId: string;
    query: string;
    limit?: number;
}

export interface IFindPathsParams {
    projectId: string;
    packageName: string;
    maxDepth?: number;
    maxPaths?: number;
}

export interface IDependencyGraphService {
    getGraph(projectId: string): Promise<IDependencyGraph>;
    findPaths(params: IFindPathsParams): Promise<IDependencyPath[]>;
    searchPackages(params: ISearchPackagesParams): Promise<string[]>;
    refreshGraph(projectId: string, projectPath: string, packageManager: string): Promise<number>;
}

export const DependencyGraphService = createAbstraction<IDependencyGraphService>(
    "Api/DependencyGraphService"
);

export namespace DependencyGraphService {
    export type Interface = IDependencyGraphService;
    export type Graph = IDependencyGraph;
    export type Edge = IDependencyGraphEdge;
    export type Path = IDependencyPath;
    export type PathNode = IDependencyPathNode;
    export type SearchPackagesParams = ISearchPackagesParams;
    export type FindPathsParams = IFindPathsParams;
}
