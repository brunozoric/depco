import { makeAutoObservable, runInAction } from "mobx";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";
import type { ScanProjectUseCase } from "../useCases/abstractions/ScanProjectUseCase.js";
import type { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";

interface ScanState {
    scanning: boolean;
    progress: ProjectDetailPresenter.ScanProgressViewModel | null;
    error: string | null;
}

interface IScanManagerDependencies {
    scanProjectUseCase: ScanProjectUseCase.Interface;
    eventBridge: EventBridge.Interface;
    getProjectId: () => string | null;
    onScanComplete: (projectId: string) => Promise<void>;
}

export class ScanManager {
    private readonly scanStates = new Map<string, ScanState>();
    public scanWarning: string | null = null;

    private readonly scanProjectUseCase: ScanProjectUseCase.Interface;
    private readonly eventBridge: EventBridge.Interface;
    private readonly getProjectId: () => string | null;
    private readonly onScanComplete: (projectId: string) => Promise<void>;

    private readonly handleProgress: EventBridge.Callback<"scan:progress">;
    private readonly handleComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleFailed: EventBridge.Callback<"scan:failed">;

    public constructor(dependencies: IScanManagerDependencies) {
        this.scanProjectUseCase = dependencies.scanProjectUseCase;
        this.eventBridge = dependencies.eventBridge;
        this.getProjectId = dependencies.getProjectId;
        this.onScanComplete = dependencies.onScanComplete;

        makeAutoObservable(this);

        this.handleProgress = data => {
            runInAction(() => {
                this.scanStates.set(data.projectId, {
                    scanning: true,
                    progress: {
                        packageName: data.packageName,
                        current: data.current,
                        total: data.total
                    },
                    error: null
                });
            });
        };

        this.handleComplete = data => {
            runInAction(() => {
                this.scanWarning = data.warning ?? null;
            });
            void this.finishScan(data.projectId);
        };

        this.handleFailed = data => {
            runInAction(() => {
                this.scanStates.set(data.projectId, {
                    scanning: false,
                    progress: null,
                    error: data.error
                });
            });
        };

        this.eventBridge.on("scan:progress", this.handleProgress);
        this.eventBridge.on("scan:complete", this.handleComplete);
        this.eventBridge.on("scan:failed", this.handleFailed);
    }

    public getState(projectId: string): ScanState | undefined {
        return this.scanStates.get(projectId);
    }

    public async scan(force?: boolean): Promise<void> {
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }

        this.scanStates.set(projectId, { scanning: true, progress: null, error: null });
        this.scanWarning = null;
        try {
            await this.scanProjectUseCase.execute(projectId, force);
        } catch (error) {
            runInAction(() => {
                this.scanStates.set(projectId, { scanning: false, progress: null, error: null });
            });
            throw error;
        }
    }

    private async finishScan(projectId: string): Promise<void> {
        await this.onScanComplete(projectId);
        runInAction(() => {
            this.scanStates.set(projectId, { scanning: false, progress: null, error: null });
        });
    }

    public dispose(): void {
        this.eventBridge.off("scan:progress", this.handleProgress);
        this.eventBridge.off("scan:complete", this.handleComplete);
        this.eventBridge.off("scan:failed", this.handleFailed);
    }
}
