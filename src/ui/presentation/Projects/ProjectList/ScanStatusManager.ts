import { makeAutoObservable, runInAction } from "mobx";
import type { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import type { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import type { ScanProjectUseCase } from "../useCases/abstractions/ScanProjectUseCase.js";
import type { CheckSecurityUseCase } from "../useCases/abstractions/CheckSecurityUseCase.js";
import type { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import type { ProjectScanStatus } from "./abstractions/ProjectListPresenter.js";

interface IScanStatusManagerDependencies {
    eventBridge: EventBridge.Interface;
    loadProjectsUseCase: LoadProjectsUseCase.Interface;
    scanProjectUseCase: ScanProjectUseCase.Interface;
    checkSecurityUseCase: CheckSecurityUseCase.Interface;
    projectsRepository: ProjectsRepository.Interface;
}

export class ScanStatusManager {
    private bulkRunning = false;
    private readonly statuses = new Map<string, ProjectScanStatus>();

    private readonly handleScanProgress: EventBridge.Callback<"scan:progress">;
    private readonly handleScanComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleScanFailed: EventBridge.Callback<"scan:failed">;
    private readonly handleInstallComplete: EventBridge.Callback<"install:complete">;
    private readonly handleJobStatus: EventBridge.Callback<"job:status">;

    public constructor(private readonly dependencies: IScanStatusManagerDependencies) {
        makeAutoObservable(this);

        this.handleScanProgress = data => {
            runInAction(() => {
                this.statuses.set(data.projectId, "scanning");
            });
        };

        this.handleScanComplete = data => {
            runInAction(() => {
                this.statuses.set(data.projectId, "done");
            });
            void this.dependencies.loadProjectsUseCase.execute();
        };

        this.handleScanFailed = data => {
            runInAction(() => {
                this.statuses.set(data.projectId, "failed");
            });
        };

        this.handleInstallComplete = () => {
            void this.dependencies.loadProjectsUseCase.execute();
        };

        this.handleJobStatus = data => {
            if (data.type !== "scan") {
                return;
            }
            runInAction(() => {
                if (data.status === "running") {
                    this.statuses.set(data.referenceId, "scanning");
                } else if (data.status === "completed") {
                    this.statuses.set(data.referenceId, "done");
                    void this.dependencies.loadProjectsUseCase.execute();
                } else if (
                    data.status === "failed" ||
                    data.status === "cancelled" ||
                    data.status === "interrupted"
                ) {
                    this.statuses.set(data.referenceId, "failed");
                }
            });
        };

        this.dependencies.eventBridge.on("scan:progress", this.handleScanProgress);
        this.dependencies.eventBridge.on("scan:complete", this.handleScanComplete);
        this.dependencies.eventBridge.on("scan:failed", this.handleScanFailed);
        this.dependencies.eventBridge.on("install:complete", this.handleInstallComplete);
        this.dependencies.eventBridge.on("job:status", this.handleJobStatus);
    }

    public get isBulkRunning(): boolean {
        return (
            this.bulkRunning ||
            Array.from(this.statuses.values()).some(status => status === "scanning")
        );
    }

    public getStatus(projectId: string): ProjectScanStatus {
        return this.statuses.get(projectId) ?? "idle";
    }

    public scanProject = async (id: string): Promise<void> => {
        runInAction(() => {
            this.statuses.set(id, "scanning");
        });
        await this.dependencies.scanProjectUseCase.execute(id);
    };

    public scanAll = async (): Promise<void> => {
        this.bulkRunning = true;
        try {
            const projects = this.dependencies.projectsRepository.getProjects();
            runInAction(() => {
                for (const project of projects) {
                    this.statuses.set(project.id, "scanning");
                }
            });
            await Promise.all(
                projects.map(project => this.dependencies.scanProjectUseCase.execute(project.id))
            );
        } finally {
            runInAction(() => {
                this.bulkRunning = false;
            });
        }
    };

    public refreshAllSecurity = async (): Promise<void> => {
        this.bulkRunning = true;
        try {
            const projects = this.dependencies.projectsRepository.getProjects();
            await Promise.all(
                projects.map(project => this.dependencies.checkSecurityUseCase.execute(project.id))
            );
            await this.dependencies.loadProjectsUseCase.execute();
        } finally {
            runInAction(() => {
                this.bulkRunning = false;
            });
        }
    };

    public dispose(): void {
        this.dependencies.eventBridge.off("scan:progress", this.handleScanProgress);
        this.dependencies.eventBridge.off("scan:complete", this.handleScanComplete);
        this.dependencies.eventBridge.off("scan:failed", this.handleScanFailed);
        this.dependencies.eventBridge.off("install:complete", this.handleInstallComplete);
        this.dependencies.eventBridge.off("job:status", this.handleJobStatus);
    }
}
