import { computed, makeAutoObservable, runInAction } from "mobx";
import { JobManagerPresenter as Abstraction } from "./abstractions/JobManagerPresenter.js";
import { LoadAllJobsUseCase } from "./useCases/abstractions/LoadAllJobsUseCase.js";
import { CancelJobUseCase } from "./useCases/abstractions/CancelJobUseCase.js";
import { DeleteJobsUseCase } from "./useCases/abstractions/DeleteJobsUseCase.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { JobsRepository } from "../../../features/jobs/abstractions/JobsRepository.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";
import { EventBridge } from "../../../events/abstractions/EventBridge.js";
import "../../../events/eventMap.js";
import type { JobsGateway } from "../../../features/jobs/abstractions/JobsGateway.js";

const PAGE_SIZE = 25;

class JobManagerPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private statusFilter: string | null = null;
    private typeFilter: string | null = null;
    private referenceFilter: string | null = null;
    private dateFrom: string | null = null;
    private dateTo: string | null = null;
    private page = 0;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private expandedJobId: string | null = null;

    private readonly handleJobStatus: EventBridge.Callback<"job:status">;
    private readonly handleJobProgress: EventBridge.Callback<"job:progress">;

    public constructor(
        private readonly loadAllJobsUseCase: LoadAllJobsUseCase.Interface,
        private readonly cancelJobUseCase: CancelJobUseCase.Interface,
        private readonly deleteJobsUseCase: DeleteJobsUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly jobsRepository: JobsRepository.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly eventBridge: EventBridge.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleJobStatus = data => {
            runInAction(() => {
                this.jobsRepository.updateJobStatus(data.jobId, data.status);
            });
            this.debouncedRefresh();
        };
        this.eventBridge.on("job:status", this.handleJobStatus);

        this.handleJobProgress = data => {
            runInAction(() => {
                this.jobsRepository.updateJobProgress(
                    data.jobId,
                    data.progress,
                    data.progressLabel
                );
            });
        };
        this.eventBridge.on("job:progress", this.handleJobProgress);
    }

    private debouncedRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            void this.load();
        }, 300);
    }

    public get vm(): Abstraction.ViewModel {
        const jobs: Abstraction.JobViewModel[] = this.jobsRepository.getJobs().map(job => ({
            id: job.id,
            referenceId: job.referenceId,
            referenceType: job.referenceType,
            projectName:
                job.referenceType === "project"
                    ? (this.projectsRepository.getProject(job.referenceId)?.name ?? "Unknown")
                    : job.referenceId,
            type: job.type,
            status: job.status,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            canCancel: job.status === "pending" || job.status === "running",
            logs: job.logs,
            warning: job.warning,
            parentJobId: job.parentJobId,
            progress: job.progress,
            progressLabel: job.progressLabel
        }));

        const references = this.projectsRepository.getProjects().map(p => ({
            label: p.name,
            value: p.id
        }));

        return {
            loading: this.loading,
            statusFilter: this.statusFilter,
            typeFilter: this.typeFilter,
            referenceFilter: this.referenceFilter,
            references,
            dateFrom: this.dateFrom,
            dateTo: this.dateTo,
            jobs,
            total: this.jobsRepository.getTotal(),
            page: this.page,
            pageSize: PAGE_SIZE,
            expandedJobId: this.expandedJobId
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        try {
            await Promise.all([
                this.loadAllJobsUseCase.execute(
                    this.buildFilters(),
                    PAGE_SIZE,
                    this.page * PAGE_SIZE
                ),
                this.loadProjectsUseCase.execute()
            ]);
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setStatusFilter = async (status: string | null): Promise<void> => {
        this.statusFilter = status;
        this.page = 0;
        await this.load();
    };

    public setFilter = (field: string, value: string | null): void => {
        switch (field) {
            case "type":
                this.typeFilter = value;
                break;
            case "reference":
                this.referenceFilter = value;
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
        this.statusFilter = null;
        this.typeFilter = null;
        this.referenceFilter = null;
        this.dateFrom = null;
        this.dateTo = null;
        this.page = 0;
        void this.load();
    };

    public setPage = (page: number): void => {
        this.page = page;
        void this.load();
    };

    public deleteFiltered = async (): Promise<void> => {
        this.loading = true;
        try {
            await this.deleteJobsUseCase.execute(this.buildFilters());
            await this.loadAllJobsUseCase.execute(
                this.buildFilters(),
                PAGE_SIZE,
                this.page * PAGE_SIZE
            );
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public cancel = async (jobId: string): Promise<void> => {
        this.jobsRepository.updateJobStatus(jobId, "cancelled");
        await this.cancelJobUseCase.execute(jobId);
    };

    public toggleJobDetails = (jobId: string): void => {
        this.expandedJobId = this.expandedJobId === jobId ? null : jobId;
    };

    public dispose = (): void => {
        this.eventBridge.off("job:status", this.handleJobStatus);
        this.eventBridge.off("job:progress", this.handleJobProgress);
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    };

    private buildFilters(): JobsGateway.Filters {
        const filters: JobsGateway.Filters = {};
        if (this.statusFilter) {
            filters.status = this.statusFilter;
        }
        if (this.typeFilter) {
            filters.type = this.typeFilter;
        }
        if (this.referenceFilter) {
            filters.referenceId = this.referenceFilter;
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

export const JobManagerPresenter = Abstraction.createImplementation({
    implementation: JobManagerPresenterImpl,
    dependencies: [
        LoadAllJobsUseCase,
        CancelJobUseCase,
        DeleteJobsUseCase,
        LoadProjectsUseCase,
        JobsRepository,
        ProjectsRepository,
        EventBridge
    ]
});
