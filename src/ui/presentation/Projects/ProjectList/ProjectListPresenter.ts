import { computed, makeAutoObservable, runInAction } from "mobx";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import { AddProjectUseCase } from "../useCases/abstractions/AddProjectUseCase.js";
import { RemoveProjectUseCase } from "../useCases/abstractions/RemoveProjectUseCase.js";
import { ScanProjectUseCase } from "../useCases/abstractions/ScanProjectUseCase.js";
import { CheckSecurityUseCase } from "../useCases/abstractions/CheckSecurityUseCase.js";
import { CloneProjectUseCase } from "../useCases/abstractions/CloneProjectUseCase.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { FilesystemGateway } from "../../../features/Filesystem/abstractions/FilesystemGateway.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private bulkRunning = false;
    private addProjectPathValue = "";
    private addProjectLoading = false;
    private addProjectError: string | null = null;
    private cloneUrl = "";
    private cloneFolderName = "";
    private cloneLoading = false;
    private cloneError: string | null = null;
    private browsePath = "";
    private browseItems: Abstraction.BrowseItem[] = [];
    private browseLoading = false;
    private scanResults: Abstraction.BrowseItem[] = [];
    private scanLoading = false;
    private scanSummary: Abstraction.ScanSummary | null = null;
    private scanDepth = 1;
    private searchQuery = "";
    private readonly scanStatuses = new Map<string, Abstraction.ScanStatus>();

    private readonly handleScanProgress: EventBridge.Callback<"scan:progress">;
    private readonly handleScanComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleScanFailed: EventBridge.Callback<"scan:failed">;
    private readonly handleInstallComplete: EventBridge.Callback<"install:complete">;
    private readonly handleJobStatus: EventBridge.Callback<"job:status">;

    public constructor(
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly addProjectUseCase: AddProjectUseCase.Interface,
        private readonly removeProjectUseCase: RemoveProjectUseCase.Interface,
        private readonly scanProjectUseCase: ScanProjectUseCase.Interface,
        private readonly checkSecurityUseCase: CheckSecurityUseCase.Interface,
        private readonly cloneProjectUseCase: CloneProjectUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly filesystemGateway: FilesystemGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleScanProgress = data => {
            runInAction(() => {
                this.scanStatuses.set(data.projectId, "scanning");
            });
        };

        this.handleScanComplete = data => {
            runInAction(() => {
                this.scanStatuses.set(data.projectId, "done");
            });
            void this.loadProjectsUseCase.execute();
        };

        this.handleScanFailed = data => {
            runInAction(() => {
                this.scanStatuses.set(data.projectId, "failed");
            });
        };

        this.handleInstallComplete = () => {
            void this.loadProjectsUseCase.execute();
        };

        this.handleJobStatus = data => {
            if (data.type !== "scan") {
                return;
            }
            runInAction(() => {
                if (data.status === "running") {
                    this.scanStatuses.set(data.referenceId, "scanning");
                } else if (data.status === "completed") {
                    this.scanStatuses.set(data.referenceId, "done");
                    void this.loadProjectsUseCase.execute();
                } else if (
                    data.status === "failed" ||
                    data.status === "cancelled" ||
                    data.status === "interrupted"
                ) {
                    this.scanStatuses.set(data.referenceId, "failed");
                }
            });
        };

        this.eventBridge.on("scan:progress", this.handleScanProgress);
        this.eventBridge.on("scan:complete", this.handleScanComplete);
        this.eventBridge.on("scan:failed", this.handleScanFailed);
        this.eventBridge.on("install:complete", this.handleInstallComplete);
        this.eventBridge.on("job:status", this.handleJobStatus);
    }

    public get vm(): Abstraction.ViewModel {
        const allProjects = this.projectsRepository.getProjects();
        const selectedTeamId = this.teamFilterService.selectedTeamId;
        const teamFiltered = selectedTeamId
            ? allProjects.filter(project =>
                  (project.teams ?? []).some(team => team.id === selectedTeamId)
              )
            : allProjects;

        const query = this.searchQuery.toLowerCase();
        const filteredProjects = query
            ? teamFiltered.filter(
                  project =>
                      project.name.toLowerCase().includes(query) ||
                      project.path.toLowerCase().includes(query) ||
                      (project.packageManager ?? "").toLowerCase().includes(query)
              )
            : teamFiltered;

        return {
            loading: this.loading,
            bulkActionRunning:
                this.bulkRunning ||
                Array.from(this.scanStatuses.values()).some(status => status === "scanning"),
            projects: filteredProjects.map((project): Abstraction.ProjectListItem => ({
                id: project.id,
                name: project.name,
                path: project.path,
                pmVersion: project.pmVersion,
                packageManager: project.packageManager ?? null,
                securityPasses: project.security?.passes ?? null,
                securityChecks: project.security?.checks ?? null,
                lastScannedAt: project.lastScannedAt,
                scanStatus: this.scanStatuses.get(project.id) ?? "idle",
                hasNodeModules: project.hasNodeModules ?? false,
                teams: (project.teams ?? []).map(team => ({
                    id: team.id,
                    name: team.name,
                    color: team.color
                }))
            })),
            addProjectPath: this.addProjectPathValue,
            addProjectLoading: this.addProjectLoading,
            addProjectError: this.addProjectError,
            cloneUrl: this.cloneUrl,
            cloneFolderName: this.cloneFolderName,
            cloneLoading: this.cloneLoading,
            cloneError: this.cloneError,
            browsePath: this.browsePath,
            browseItems: this.browseItems,
            browseLoading: this.browseLoading,
            scanResults: this.scanResults,
            scanLoading: this.scanLoading,
            scanSummary: this.scanSummary,
            scanDepth: this.scanDepth,
            searchQuery: this.searchQuery
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        try {
            await this.loadProjectsUseCase.execute();
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setAddProjectPath = (path: string): void => {
        this.addProjectPathValue = path;
    };

    public addProject = async (): Promise<void> => {
        this.addProjectLoading = true;
        this.addProjectError = null;
        try {
            const path = this.addProjectPathValue;
            await this.addProjectUseCase.execute(path);
            runInAction(() => {
                this.addProjectPathValue = "";
            });
        } catch (error) {
            runInAction(() => {
                this.addProjectError =
                    error instanceof Error ? error.message : "Failed to add project";
            });
        } finally {
            runInAction(() => {
                this.addProjectLoading = false;
            });
        }
    };

    public addProjects = async (paths: string[]): Promise<void> => {
        this.addProjectLoading = true;
        this.addProjectError = null;
        try {
            for (const path of paths) {
                await this.addProjectUseCase.execute(path);
            }
        } catch (error) {
            runInAction(() => {
                this.addProjectError =
                    error instanceof Error ? error.message : "Failed to add projects";
            });
        } finally {
            runInAction(() => {
                this.addProjectLoading = false;
            });
        }
    };

    public removeProject = async (id: string): Promise<void> => {
        await this.removeProjectUseCase.execute(id);
    };

    public scanAll = async (): Promise<void> => {
        this.bulkRunning = true;
        try {
            const projects = this.projectsRepository.getProjects();
            runInAction(() => {
                for (const project of projects) {
                    this.scanStatuses.set(project.id, "scanning");
                }
            });
            await Promise.all(projects.map(project => this.scanProjectUseCase.execute(project.id)));
        } finally {
            runInAction(() => {
                this.bulkRunning = false;
            });
        }
    };

    public refreshAllSecurity = async (): Promise<void> => {
        this.bulkRunning = true;
        try {
            const projects = this.projectsRepository.getProjects();
            await Promise.all(
                projects.map(project => this.checkSecurityUseCase.execute(project.id))
            );
            await this.loadProjectsUseCase.execute();
        } finally {
            runInAction(() => {
                this.bulkRunning = false;
            });
        }
    };

    public setCloneUrl = (url: string): void => {
        this.cloneUrl = url;
        const match = url.match(/\/([^/]+?)(?:\.git)?$/);
        if (match) {
            this.cloneFolderName = match[1]!;
        }
    };

    public setCloneFolderName = (name: string): void => {
        this.cloneFolderName = name;
    };

    public browseTo = async (path: string): Promise<void> => {
        this.browseLoading = true;
        try {
            const result = await this.filesystemGateway.browse(path || undefined);
            runInAction(() => {
                this.browsePath = result.currentPath;
                this.browseItems = result.items;
                this.browseLoading = false;
            });
        } catch {
            runInAction(() => {
                this.browseLoading = false;
            });
        }
    };

    public install = async (projectId: string, flags: string[] = []): Promise<void> => {
        await this.projectsGateway.install(projectId, flags);
    };

    public getInstallOptions = async (
        packageManager: string
    ): Promise<ProjectsGateway.InstallFlagDefinition[]> => {
        return this.projectsGateway.getInstallOptions(packageManager);
    };

    public scanDirectory = async (): Promise<void> => {
        this.scanLoading = true;
        try {
            const result = await this.filesystemGateway.scan(this.browsePath, this.scanDepth);
            runInAction(() => {
                this.scanResults = result.items;
                this.scanSummary = {
                    scannedPath: result.scannedPath,
                    scannedCount: result.scannedCount,
                    filteredCount: result.filteredCount,
                    mode: result.mode
                };
            });
        } catch (error) {
            runInAction(() => {
                this.addProjectError =
                    error instanceof Error ? error.message : "Failed to scan directory";
            });
        } finally {
            runInAction(() => {
                this.scanLoading = false;
            });
        }
    };

    public clearScan = (): void => {
        this.scanResults = [];
        this.scanSummary = null;
    };

    public setScanDepth = (depth: number): void => {
        this.scanDepth = Math.max(1, Math.min(5, depth));
    };

    public setSearchQuery = (value: string): void => {
        this.searchQuery = value;
    };

    public scanProject = async (id: string): Promise<void> => {
        runInAction(() => {
            this.scanStatuses.set(id, "scanning");
        });
        await this.scanProjectUseCase.execute(id);
    };

    public dispose = (): void => {
        this.eventBridge.off("scan:progress", this.handleScanProgress);
        this.eventBridge.off("scan:complete", this.handleScanComplete);
        this.eventBridge.off("scan:failed", this.handleScanFailed);
        this.eventBridge.off("install:complete", this.handleInstallComplete);
        this.eventBridge.off("job:status", this.handleJobStatus);
    };

    public cloneProject = async (): Promise<void> => {
        this.cloneLoading = true;
        this.cloneError = null;
        try {
            await this.cloneProjectUseCase.execute(
                this.cloneUrl,
                this.browsePath,
                this.cloneFolderName || undefined
            );
            runInAction(() => {
                this.cloneLoading = false;
                this.cloneUrl = "";
                this.cloneFolderName = "";
            });
            await this.load();
        } catch (error) {
            runInAction(() => {
                this.cloneLoading = false;
                this.cloneError =
                    error instanceof Error ? error.message : "Failed to clone project";
            });
        }
    };
}

export const ProjectListPresenter = Abstraction.createImplementation({
    implementation: ProjectListPresenterImpl,
    dependencies: [
        LoadProjectsUseCase,
        AddProjectUseCase,
        RemoveProjectUseCase,
        ScanProjectUseCase,
        CheckSecurityUseCase,
        CloneProjectUseCase,
        ProjectsRepository,
        ProjectsGateway,
        EventBridge,
        FilesystemGateway,
        TeamFilterService
    ]
});
