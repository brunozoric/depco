import { computed, makeAutoObservable, runInAction } from "mobx";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import { CloneManagerFactory } from "./abstractions/CloneManagerFactory.js";
import { DirectoryScanManagerFactory } from "./abstractions/DirectoryScanManagerFactory.js";
import { ScanStatusManagerFactory } from "./abstractions/ScanStatusManagerFactory.js";
import { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import { AddProjectUseCase } from "../useCases/abstractions/AddProjectUseCase.js";
import { RemoveProjectUseCase } from "../useCases/abstractions/RemoveProjectUseCase.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { FilesystemGateway } from "../../../features/Filesystem/abstractions/FilesystemGateway.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private addProjectPathValue = "";
    private addProjectLoading = false;
    private addProjectError: string | null = null;
    private browsePath = "";
    private browseItems: Abstraction.BrowseItem[] = [];
    private browseLoading = false;
    private searchQuery = "";

    public readonly cloneManager: CloneManagerFactory.Manager;
    public readonly directoryScanManager: DirectoryScanManagerFactory.Manager;
    public readonly scanStatusManager: ScanStatusManagerFactory.Manager;

    public constructor(
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly addProjectUseCase: AddProjectUseCase.Interface,
        private readonly removeProjectUseCase: RemoveProjectUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly filesystemGateway: FilesystemGateway.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        cloneManagerFactory: CloneManagerFactory.Interface,
        directoryScanManagerFactory: DirectoryScanManagerFactory.Interface,
        scanStatusManagerFactory: ScanStatusManagerFactory.Interface
    ) {
        this.cloneManager = cloneManagerFactory.create({
            getBrowsePath: () => this.browsePath,
            onCloned: () => this.load()
        });
        this.directoryScanManager = directoryScanManagerFactory.create({
            getBrowsePath: () => this.browsePath
        });
        this.scanStatusManager = scanStatusManagerFactory.create();

        makeAutoObservable(this, { vm: computed });
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
            bulkActionRunning: this.scanStatusManager.isBulkRunning,
            projects: filteredProjects.map((project): Abstraction.ProjectListItem => ({
                id: project.id,
                name: project.name,
                path: project.path,
                pmVersion: project.pmVersion,
                packageManager: project.packageManager ?? null,
                securityPasses: project.security?.passes ?? null,
                securityChecks: project.security?.checks ?? null,
                lastScannedAt: project.lastScannedAt,
                scanStatus: this.scanStatusManager.getStatus(project.id),
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
            cloneUrl: this.cloneManager.url,
            cloneFolderName: this.cloneManager.folderName,
            cloneLoading: this.cloneManager.loading,
            cloneError: this.cloneManager.error,
            browsePath: this.browsePath,
            browseItems: this.browseItems,
            browseLoading: this.browseLoading,
            scanResults: this.directoryScanManager.results,
            scanLoading: this.directoryScanManager.loading,
            scanSummary: this.directoryScanManager.summary,
            scanDepth: this.directoryScanManager.depth,
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
        await this.scanStatusManager.scanAll();
    };

    public refreshAllSecurity = async (): Promise<void> => {
        await this.scanStatusManager.refreshAllSecurity();
    };

    public setCloneUrl = (url: string): void => {
        this.cloneManager.setUrl(url);
    };

    public setCloneFolderName = (name: string): void => {
        this.cloneManager.setFolderName(name);
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
        const error = await this.directoryScanManager.scan();
        if (error) {
            runInAction(() => {
                this.addProjectError = error;
            });
        }
    };

    public clearScan = (): void => {
        this.directoryScanManager.clear();
    };

    public setScanDepth = (depth: number): void => {
        this.directoryScanManager.setDepth(depth);
    };

    public setSearchQuery = (value: string): void => {
        this.searchQuery = value;
    };

    public scanProject = async (id: string): Promise<void> => {
        await this.scanStatusManager.scanProject(id);
    };

    public dispose = (): void => {
        this.scanStatusManager.dispose();
    };

    public cloneProject = async (): Promise<void> => {
        await this.cloneManager.clone();
    };
}

export const ProjectListPresenter = Abstraction.createImplementation({
    implementation: ProjectListPresenterImpl,
    dependencies: [
        LoadProjectsUseCase,
        AddProjectUseCase,
        RemoveProjectUseCase,
        ProjectsRepository,
        ProjectsGateway,
        FilesystemGateway,
        TeamFilterService,
        CloneManagerFactory,
        DirectoryScanManagerFactory,
        ScanStatusManagerFactory
    ]
});
