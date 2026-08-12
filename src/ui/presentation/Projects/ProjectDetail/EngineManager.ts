import { makeAutoObservable, runInAction } from "mobx";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";
import type { EnginesGateway } from "../../../features/Engines/abstractions/EnginesGateway.js";
import type { EnginesRepository } from "../../../features/Engines/abstractions/EnginesRepository.js";
import type { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";

const ENGINE_STATUS_SORT_PRIORITY: Record<string, number> = {
    eol: 0,
    maintenance: 1,
    unknown: 2,
    "active-lts": 3,
    current: 4
};

interface IEngineManagerDependencies {
    enginesGateway: EnginesGateway.Interface;
    enginesRepository: EnginesRepository.Interface;
    eventBridge: EventBridge.Interface;
    getProjectId: () => string | null;
}

export class EngineManager {
    public showMaintenance = true;
    private staleness: EnginesGateway.StalenessData | null = null;

    private readonly handleEngineScanComplete: EventBridge.Callback<"engine-scan:complete">;

    public constructor(private readonly dependencies: IEngineManagerDependencies) {
        makeAutoObservable(this);

        this.handleEngineScanComplete = data => {
            if (data.projectId === this.dependencies.getProjectId()) {
                void this.load(data.projectId);
            }
        };

        this.dependencies.eventBridge.on("engine-scan:complete", this.handleEngineScanComplete);
    }

    public load = async (projectId: string): Promise<void> => {
        try {
            const [response, staleness] = await Promise.all([
                this.dependencies.enginesGateway.getByProject(projectId),
                this.dependencies.enginesGateway.getStaleness(projectId)
            ]);
            runInAction(() => {
                this.dependencies.enginesRepository.setChecks(response.items, response.total);
                this.staleness = staleness;
            });
        } catch {
            // Engine data is supplementary — its failure should not break the detail page.
        }
    };

    public toggleMaintenance = (): void => {
        this.showMaintenance = !this.showMaintenance;
    };

    public getViewModel(
        projectId: string | null
    ): ProjectDetailPresenter.EngineDataViewModel | null {
        if (!projectId) {
            return null;
        }

        const checks = this.dependencies.enginesRepository.getChecks();
        const rootCheck = checks.find(check => check.packageName === "");
        if (!rootCheck) {
            return null;
        }

        const findings = checks
            .filter(check => check.packageName !== "")
            .map((check): ProjectDetailPresenter.EngineFindingViewModel => ({
                packageName: check.packageName,
                enginesNode: check.enginesNode,
                status: check.status,
                eolDate: check.eolDate
            }))
            .sort(
                (a, b) =>
                    (ENGINE_STATUS_SORT_PRIORITY[a.status] ?? 99) -
                    (ENGINE_STATUS_SORT_PRIORITY[b.status] ?? 99)
            );

        return {
            rootStatus: rootCheck.status,
            rootEnginesNode: rootCheck.enginesNode,
            rootEolDate: rootCheck.eolDate,
            findings,
            lastScannedAt: this.staleness?.lastScannedAt ?? null,
            engineScanStale: this.staleness?.engineScanStale ?? false,
            engineScanStaleReason: this.staleness?.engineScanStaleReason ?? null
        };
    }

    public dispose(): void {
        this.dependencies.eventBridge.off("engine-scan:complete", this.handleEngineScanComplete);
    }
}
