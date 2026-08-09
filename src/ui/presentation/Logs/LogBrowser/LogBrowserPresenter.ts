import { computed, makeAutoObservable, runInAction } from "mobx";
import { LogBrowserPresenter as Abstraction } from "./abstractions/LogBrowserPresenter.js";
import { LoadAppLogsUseCase } from "../useCases/abstractions/LoadAppLogsUseCase.js";
import { DeleteAppLogsUseCase } from "../useCases/abstractions/DeleteAppLogsUseCase.js";
import { AppLogsRepository } from "../../../features/AppLogs/abstractions/AppLogsRepository.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase } from "../../Projects/useCases/abstractions/LoadProjectsUseCase.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import type { AppLogsGateway } from "../../../features/AppLogs/abstractions/AppLogsGateway.js";

const PAGE_SIZE = 50;

class LogBrowserPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private levelFilter: string | null = null;
    private sourceFilter: string | null = null;
    private projectFilter: string | null = null;
    private dateFrom: string | null = null;
    private dateTo: string | null = null;
    private page = 0;
    private expandedLogId: string | null = null;

    private readonly handleLogCreated: EventBridge.Callback<"log:created">;

    public constructor(
        private readonly loadLogsUseCase: LoadAppLogsUseCase.Interface,
        private readonly deleteLogsUseCase: DeleteAppLogsUseCase.Interface,
        private readonly logsRepository: AppLogsRepository.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly eventBridge: EventBridge.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleLogCreated = data => {
            runInAction(() => {
                this.logsRepository.prependLog({
                    id: data.id,
                    level: data.level,
                    source: data.source,
                    projectId: data.projectId,
                    message: data.message,
                    details: null,
                    createdAt: data.createdAt
                });
            });
        };
        this.eventBridge.on("log:created", this.handleLogCreated);
    }

    public get vm(): Abstraction.ViewModel {
        const logs: Abstraction.LogViewModel[] = this.logsRepository.getLogs().map(log => ({
            id: log.id,
            level: log.level,
            source: log.source,
            projectName: log.projectId
                ? (this.projectsRepository.getProject(log.projectId)?.name ?? log.projectId)
                : null,
            message: log.message,
            details: log.details,
            createdAt: log.createdAt
        }));

        const projects = this.projectsRepository.getProjects().map(p => ({
            label: p.name,
            value: p.id
        }));

        return {
            loading: this.loading,
            error: this.error,
            logs,
            total: this.logsRepository.getTotal(),
            levelFilter: this.levelFilter,
            sourceFilter: this.sourceFilter,
            projectFilter: this.projectFilter,
            projects,
            dateFrom: this.dateFrom,
            dateTo: this.dateTo,
            page: this.page,
            pageSize: PAGE_SIZE,
            expandedLogId: this.expandedLogId
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await Promise.all([
                this.loadLogsUseCase.execute(this.buildFilters(), PAGE_SIZE, this.page * PAGE_SIZE),
                this.loadProjectsUseCase.execute()
            ]);
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to load logs";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setFilter = (field: string, value: string | null): void => {
        switch (field) {
            case "level":
                this.levelFilter = value;
                break;
            case "source":
                this.sourceFilter = value;
                break;
            case "project":
                this.projectFilter = value;
                break;
            case "dateFrom":
                this.dateFrom = value;
                break;
            case "dateTo":
                this.dateTo = value;
                break;
        }
        this.page = 0;
        void this.load();
    };

    public clearFilters = (): void => {
        this.levelFilter = null;
        this.sourceFilter = null;
        this.projectFilter = null;
        this.dateFrom = null;
        this.dateTo = null;
        this.page = 0;
        void this.load();
    };

    public toggleDetails = (id: string): void => {
        this.expandedLogId = this.expandedLogId === id ? null : id;
    };

    public deleteFiltered = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await this.deleteLogsUseCase.execute(this.buildFilters());
            await this.loadLogsUseCase.execute(
                this.buildFilters(),
                PAGE_SIZE,
                this.page * PAGE_SIZE
            );
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to delete logs";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setPage = (page: number): void => {
        this.page = page;
        void this.load();
    };

    public dispose = (): void => {
        this.eventBridge.off("log:created", this.handleLogCreated);
    };

    private buildFilters(): AppLogsGateway.Filters {
        const filters: AppLogsGateway.Filters = {};
        if (this.levelFilter) {
            filters.level = this.levelFilter;
        }
        if (this.sourceFilter) {
            filters.source = this.sourceFilter;
        }
        if (this.projectFilter) {
            filters.projectId = this.projectFilter;
        }
        if (this.dateFrom) {
            filters.from = this.dateFrom;
        }
        if (this.dateTo) {
            filters.to = this.dateTo;
        }
        return filters;
    }
}

export const LogBrowserPresenter = Abstraction.createImplementation({
    implementation: LogBrowserPresenterImpl,
    dependencies: [
        LoadAppLogsUseCase,
        DeleteAppLogsUseCase,
        AppLogsRepository,
        ProjectsRepository,
        LoadProjectsUseCase,
        EventBridge
    ]
});
