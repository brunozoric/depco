import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { EngineScanJobExecutor as Abstraction } from "./abstractions/EngineScanJobExecutor.js";
import { EngineService } from "../../Engine/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";

class EngineScanJobExecutorImpl implements Abstraction.Interface {
    public readonly type = "engine-scan" as const;

    public constructor(
        private readonly engineService: EngineService.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const projectId = context.referenceId;

        context.appendLog(`Starting engine scan for project ${projectId}`);
        context.setProgress({ percent: 0, label: "Scanning engines..." });

        const result = await this.engineService.scan({
            projectId,
            projectPath: context.projectPath
        });

        this.webSocketBroadcaster.broadcast("engine-scan:complete", {
            projectId,
            counts: result.summary.counts
        });

        context.setProgress({ percent: 100, label: "Engine scan complete" });
        context.appendLog(
            `Engine scan complete: ${result.summary.counts.eol} EOL, ${result.summary.counts.maintenance} maintenance, ${result.summary.counts.activeLts} active LTS, ${result.summary.counts.current} current, ${result.summary.counts.unknown} unknown`
        );
    }
}

export const EngineScanJobExecutor = Abstraction.createImplementation({
    implementation: EngineScanJobExecutorImpl,
    dependencies: [EngineService, WebSocketBroadcaster]
});
