import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { GraphRefreshJobExecutor as Abstraction } from "./abstractions/GraphRefreshJobExecutor.js";
import { DependencyGraphService } from "../abstractions/DependencyGraphService.js";

class GraphRefreshJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "graph-refresh" as const;

    public constructor(private readonly dependencyGraphService: DependencyGraphService.Interface) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        context.appendLog(`Starting dependency graph refresh for project ${context.referenceId}`);
        context.setProgress({ percent: 0, label: "Refreshing dependency graph..." });

        try {
            const edgeCount = await this.dependencyGraphService.refreshGraph(
                context.referenceId,
                context.projectPath,
                context.packageManager
            );
            context.appendLog(`Dependency graph refreshed: ${edgeCount} edges`);
            context.setProgress({ percent: 100, label: "Dependency graph refresh complete" });
        } catch (error) {
            context.appendLog(`Dependency graph refresh failed: ${String(error)}`);
            context.setProgress({ percent: 100, label: "Dependency graph refresh failed" });
            throw error;
        }
    }
}

export const GraphRefreshJobExecutor = Abstraction.createImplementation({
    implementation: GraphRefreshJobExecutorImpl,
    dependencies: [DependencyGraphService]
});
