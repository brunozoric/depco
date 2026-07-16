import { DependencyGraphRepository as Abstraction } from "./abstractions/DependencyGraphRepository.js";
import type { DependencyGraphGateway } from "./abstractions/DependencyGraphGateway.js";

class DependencyGraphRepositoryImpl implements Abstraction.Interface {
    private graph: DependencyGraphGateway.Graph | null = null;
    private paths: DependencyGraphGateway.Path[] = [];
    private stats: DependencyGraphGateway.Stats | null = null;

    public getGraph(): DependencyGraphGateway.Graph | null {
        return this.graph;
    }

    public setGraph(graph: DependencyGraphGateway.Graph): void {
        this.graph = graph;
    }

    public getPaths(): DependencyGraphGateway.Path[] {
        return this.paths;
    }

    public setPaths(paths: DependencyGraphGateway.Path[]): void {
        this.paths = paths;
    }

    public getStats(): DependencyGraphGateway.Stats | null {
        return this.stats;
    }

    public setStats(stats: DependencyGraphGateway.Stats): void {
        this.stats = stats;
    }
}

export const DependencyGraphRepository = Abstraction.createImplementation({
    implementation: DependencyGraphRepositoryImpl,
    dependencies: []
});
