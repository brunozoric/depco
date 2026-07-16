import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
import { TrendsPresenter as Abstraction } from "./abstractions/TrendsPresenter.js";
import { LoadTrendsUseCase } from "../useCases/abstractions/LoadTrendsUseCase.js";
import { LoadDependencyChangesUseCase } from "../useCases/abstractions/LoadDependencyChangesUseCase.js";
import { TrendsRepository } from "../../../features/trends/abstractions/TrendsRepository.js";
import type { TrendsGateway } from "../../../features/trends/abstractions/TrendsGateway.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";
import { TeamFilterService } from "../../../features/teamFilter/abstractions/TeamFilterService.js";

const DEFAULT_RANGE = "30";

class TrendsPresenterImpl implements Abstraction.Interface {
    private loading = true;
    private error: string | null = null;
    private stalenessRange = DEFAULT_RANGE;
    private licenseRange = DEFAULT_RANGE;
    private autoFixRange = DEFAULT_RANGE;
    private dependencyChangesProjectFilter: string | null = null;
    private readonly disposeTeamReaction: () => void;

    public constructor(
        private readonly loadTrendsUseCase: LoadTrendsUseCase.Interface,
        private readonly loadDependencyChangesUseCase: LoadDependencyChangesUseCase.Interface,
        private readonly repository: TrendsRepository.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly teamFilterService: TeamFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            stalenessPoints: this.repository.getStalenessTrend(),
            stalenessRange: this.stalenessRange,
            licensePoints: this.repository.getLicenseTrend(),
            licenseRange: this.licenseRange,
            autoFixPoints: this.repository.getAutoFixTrend(),
            autoFixRange: this.autoFixRange,
            packageCountPoints: this.repository.getStalenessTrend().map(point => ({
                date: point.date,
                totalPackages: point.totalPackages
            })),
            dependencyChanges: this.repository.getDependencyChanges(),
            dependencyChangesTotal: this.repository.getDependencyChangesTotal(),
            dependencyChangesProjectFilter: this.dependencyChangesProjectFilter,
            availableProjects: this.projectsRepository.getProjects().map(project => ({
                id: project.id,
                name: project.name
            }))
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            const tasks: Promise<unknown>[] = [
                this.loadTrendsUseCase.execute({
                    staleness: this.stalenessRange,
                    license: this.licenseRange,
                    autoFix: this.autoFixRange,
                    ...this.buildTeamIdFilter()
                }),
                this.loadDependencyChangesUseCase.execute(this.buildDependencyChangesFilters())
            ];
            if (this.projectsRepository.getProjects().length === 0) {
                tasks.push(this.loadProjectsUseCase.execute());
            }
            await Promise.all(tasks);
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load trends";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setStalenessRange = (range: string): void => {
        this.stalenessRange = range;
        this.error = null;
        void this.loadTrendsUseCase
            .execute({ staleness: range, ...this.buildTeamIdFilter() })
            .catch(err => {
                runInAction(() => {
                    this.error =
                        err instanceof Error ? err.message : "Failed to load staleness trend";
                });
            });
    };

    public setLicenseRange = (range: string): void => {
        this.licenseRange = range;
        this.error = null;
        void this.loadTrendsUseCase
            .execute({ license: range, ...this.buildTeamIdFilter() })
            .catch(err => {
                runInAction(() => {
                    this.error =
                        err instanceof Error ? err.message : "Failed to load license trend";
                });
            });
    };

    public setAutoFixRange = (range: string): void => {
        this.autoFixRange = range;
        this.error = null;
        void this.loadTrendsUseCase
            .execute({ autoFix: range, ...this.buildTeamIdFilter() })
            .catch(err => {
                runInAction(() => {
                    this.error =
                        err instanceof Error ? err.message : "Failed to load auto-fix trend";
                });
            });
    };

    public setDependencyChangesProjectFilter = (projectId: string | null): void => {
        this.dependencyChangesProjectFilter = projectId;
        this.error = null;
        void this.loadDependencyChangesUseCase
            .execute(this.buildDependencyChangesFilters())
            .catch(err => {
                runInAction(() => {
                    this.error =
                        err instanceof Error ? err.message : "Failed to load dependency changes";
                });
            });
    };

    public dispose = (): void => {
        this.disposeTeamReaction();
    };

    private buildDependencyChangesFilters(): TrendsGateway.DependencyChangesFilters {
        return {
            ...(this.dependencyChangesProjectFilter
                ? { projectId: this.dependencyChangesProjectFilter }
                : {}),
            ...this.buildTeamIdFilter()
        };
    }

    private buildTeamIdFilter(): { teamId: string } | Record<string, never> {
        const teamId = this.teamFilterService.selectedTeamId;
        return teamId ? { teamId } : {};
    }
}

export const TrendsPresenter = Abstraction.createImplementation({
    implementation: TrendsPresenterImpl,
    dependencies: [
        LoadTrendsUseCase,
        LoadDependencyChangesUseCase,
        TrendsRepository,
        LoadProjectsUseCase,
        ProjectsRepository,
        TeamFilterService
    ]
});
