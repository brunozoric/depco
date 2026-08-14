import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
import { notifications } from "@mantine/notifications";
import { getErrorMessage } from "#shared/errors.js";
import { listProjectsRoute } from "#shared/routes/index.js";
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
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";
import { EnginesGateway } from "../../../features/Engines/abstractions/EnginesGateway.js";
import { EnginesRepository } from "../../../features/Engines/abstractions/EnginesRepository.js";
import type { EngineStatus } from "#shared/engines/types.js";
import type { z } from "zod";

const DEFAULT_PAGE_SIZE = 25;

const FILTER_SCHEMA = listProjectsRoute.querystring as NonNullable<
    typeof listProjectsRoute.querystring
> &
    z.ZodObject<z.ZodRawShape>;

class ProjectListPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private addProjectPathValue = "";
    private addProjectLoading = false;
    private addProjectError: string | null = null;
    private browsePath = "";
    private browseItems: Abstraction.BrowseItem[] = [];
    private browseLoading = false;
    private readonly selectedProjectIds = new Set<string>();
    private scanningAllEnginesValue = false;
    private disposeUrlListener: () => void;
    private disposeTeamReaction: () => void;

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
        private readonly urlFilterService: UrlFilterService.Interface,
        private readonly enginesGateway: EnginesGateway.Interface,
        private readonly enginesRepository: EnginesRepository.Interface,
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

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            void this.loadProjects();
        });

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                this.urlFilterService.update(FILTER_SCHEMA, { page: null });
            }
        );

        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        const projects = this.projectsRepository.getProjects();
        const total = this.projectsRepository.getProjectsTotal();
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;

        const engineSummary = this.enginesRepository.getSummary();
        interface IEngineInfo {
            status: EngineStatus;
            enginesNode: string | null;
        }

        const engineInfoByProjectId = new Map<string, IEngineInfo>();
        for (const projectSummary of engineSummary?.projectSummaries ?? []) {
            engineInfoByProjectId.set(projectSummary.projectId, {
                status: projectSummary.rootStatus,
                enginesNode: projectSummary.rootEnginesNode
            });
        }

        return {
            loading: this.loading,
            bulkActionRunning: this.scanStatusManager.isBulkRunning,
            projects: projects.map((project): Abstraction.ProjectListItem => ({
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
                })),
                engineStatus: engineInfoByProjectId.get(project.id)?.status ?? null,
                engineVersion: engineInfoByProjectId.get(project.id)?.enginesNode ?? null
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
            searchQuery: urlFilters.search ?? "",
            selectedProjectIds: projects
                .map(project => project.id)
                .filter(id => this.selectedProjectIds.has(id)),
            scanningAllEngines: this.scanningAllEnginesValue,
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            totalProjects: total
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        try {
            await Promise.all([this.loadProjects(), this.loadEngineSummary()]);
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    private loadProjects = async (): Promise<void> => {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const teamId = this.teamFilterService.selectedTeamId;
        await this.loadProjectsUseCase.execute({
            page: urlFilters.page ?? 1,
            pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE,
            search: urlFilters.search ?? undefined,
            teamId: teamId ?? undefined
        });
    };

    private loadEngineSummary = async (): Promise<void> => {
        try {
            const summary = await this.enginesGateway.getSummary();
            runInAction(() => {
                this.enginesRepository.setSummary(summary);
            });
        } catch {
            // Engine summary is supplementary — its failure should not block the project list.
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
        runInAction(() => {
            this.selectedProjectIds.delete(id);
        });
    };

    public scanAll = async (): Promise<void> => {
        await this.scanStatusManager.scanAll();
    };

    public scanAllEngines = async (): Promise<void> => {
        const projectIds = this.vm.projects.map(project => project.id);
        if (projectIds.length === 0) {
            return;
        }
        this.scanningAllEnginesValue = true;
        try {
            const result = await this.enginesGateway.bulkScanEngines(projectIds);
            notifications.show({
                color: "green",
                title: "Engine scan complete",
                message: `Scanned engines for ${result.scannedCount} project${
                    result.scannedCount === 1 ? "" : "s"
                }`
            });
            await this.load();
        } catch (error) {
            notifications.show({
                color: "red",
                title: "Engine scan failed",
                message: getErrorMessage(error, "Failed to scan engines")
            });
        } finally {
            runInAction(() => {
                this.scanningAllEnginesValue = false;
            });
        }
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
        this.urlFilterService.update(FILTER_SCHEMA, {
            search: value || null,
            page: null
        });
    };

    public setPage = (page: number): void => {
        this.urlFilterService.update(FILTER_SCHEMA, {
            page: page > 1 ? String(page) : null
        });
    };

    public scanProject = async (id: string): Promise<void> => {
        await this.scanStatusManager.scanProject(id);
    };

    public toggleProjectSelection = (id: string): void => {
        if (this.selectedProjectIds.has(id)) {
            this.selectedProjectIds.delete(id);
        } else {
            this.selectedProjectIds.add(id);
        }
    };

    public selectAllProjects = (): void => {
        for (const project of this.vm.projects) {
            this.selectedProjectIds.add(project.id);
        }
    };

    public deselectAllProjects = (): void => {
        this.selectedProjectIds.clear();
    };

    public bulkScanSelected = async (): Promise<void> => {
        const projectIds = Array.from(this.selectedProjectIds);
        if (projectIds.length === 0) {
            return;
        }
        try {
            const result = await this.projectsGateway.bulkScan(projectIds);
            runInAction(() => {
                this.selectedProjectIds.clear();
            });
            notifications.show({
                color: result.skippedCount > 0 ? "yellow" : "green",
                title: "Bulk scan enqueued",
                message:
                    `Enqueued ${result.enqueuedCount} scan${result.enqueuedCount === 1 ? "" : "s"}` +
                    (result.skippedCount > 0
                        ? `, skipped ${result.skippedCount} already scanning`
                        : "")
            });
        } catch (error) {
            notifications.show({
                color: "red",
                title: "Bulk scan failed",
                message: getErrorMessage(error, "Failed to enqueue bulk scan")
            });
        }
    };

    public dispose = (): void => {
        this.scanStatusManager.dispose();
        this.disposeUrlListener();
        this.disposeTeamReaction();
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
        UrlFilterService,
        EnginesGateway,
        EnginesRepository,
        CloneManagerFactory,
        DirectoryScanManagerFactory,
        ScanStatusManagerFactory
    ]
});
