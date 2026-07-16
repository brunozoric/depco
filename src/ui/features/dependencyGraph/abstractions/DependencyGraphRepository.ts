import { createAbstraction } from "#shared/index.js";
import type { DependencyGraphGateway } from "./DependencyGraphGateway.js";

export interface IDependencyGraphRepository {
    getGraph(): DependencyGraphGateway.Graph | null;
    setGraph(graph: DependencyGraphGateway.Graph): void;
    getPaths(): DependencyGraphGateway.Path[];
    setPaths(paths: DependencyGraphGateway.Path[]): void;
    getStats(): DependencyGraphGateway.Stats | null;
    setStats(stats: DependencyGraphGateway.Stats): void;
}

export const DependencyGraphRepository = createAbstraction<IDependencyGraphRepository>(
    "Ui/DependencyGraphRepository"
);

export namespace DependencyGraphRepository {
    export type Interface = IDependencyGraphRepository;
}
