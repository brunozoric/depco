import { computed, makeAutoObservable, runInAction } from "mobx";
import { SbomPresenter as Abstraction } from "./abstractions/SbomPresenter.js";
import { ExportSbomUseCase } from "../useCases/abstractions/ExportSbomUseCase.js";
import { LoadProjectsUseCase } from "../../Projects/useCases/abstractions/LoadProjectsUseCase.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { getErrorMessage } from "#shared/errors.js";

class SbomPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private exporting = false;
    private error: string | null = null;
    private selectedProjectId: string | null = null;
    private selectedFormat = "cyclonedx";

    public constructor(
        private readonly exportSbomUseCase: ExportSbomUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            exporting: this.exporting,
            error: this.error,
            availableProjects: this.projectsRepository.getProjects().map(project => ({
                id: project.id,
                name: project.name
            })),
            selectedProjectId: this.selectedProjectId,
            selectedFormat: this.selectedFormat,
            canExportProject: this.selectedProjectId !== null
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            if (this.projectsRepository.getProjects().length === 0) {
                await this.loadProjectsUseCase.execute();
            }
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to load projects");
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setSelectedProjectId = (projectId: string | null): void => {
        this.selectedProjectId = projectId;
    };

    public setSelectedFormat = (format: string): void => {
        this.selectedFormat = format;
    };

    public exportProject = async (): Promise<void> => {
        if (!this.selectedProjectId) {
            return;
        }
        this.exporting = true;
        this.error = null;
        try {
            await this.exportSbomUseCase.exportProject(this.selectedProjectId, this.selectedFormat);
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Export failed");
            });
        } finally {
            runInAction(() => {
                this.exporting = false;
            });
        }
    };

    public exportAll = async (): Promise<void> => {
        this.exporting = true;
        this.error = null;
        try {
            await this.exportSbomUseCase.exportAll(this.selectedFormat);
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Export failed");
            });
        } finally {
            runInAction(() => {
                this.exporting = false;
            });
        }
    };
}

export const SbomPresenter = Abstraction.createImplementation({
    implementation: SbomPresenterImpl,
    dependencies: [ExportSbomUseCase, LoadProjectsUseCase, ProjectsRepository]
});
