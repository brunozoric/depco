import { computed, makeAutoObservable, runInAction } from "mobx";
import { JobProgressPresenter as Abstraction } from "./abstractions/JobProgressPresenter.js";
import { GetJobUseCase } from "../../upgrades/useCases/abstractions/GetJobUseCase.js";
import { GetJobsUseCase } from "../../upgrades/useCases/abstractions/GetJobsUseCase.js";
import { UpgradesRepository } from "../../../features/Upgrades/abstractions/UpgradesRepository.js";
import { EventBridge } from "../../../events/abstractions/EventBridge.js";
import "../../../events/eventMap.js";

class JobProgressPresenterImpl implements Abstraction.Interface {
    private currentReferenceId: string | null = null;
    private currentJobId: string | null = null;
    private tracking = false;

    private readonly handleJobStatus: EventBridge.Callback<"job:status">;
    private readonly handleJobLog: EventBridge.Callback<"job:log">;
    private readonly handleJobProgress: EventBridge.Callback<"job:progress">;
    private readonly handleReconnect: EventBridge.Callback<"ws:reconnected">;

    public constructor(
        private readonly getJobUseCase: GetJobUseCase.Interface,
        private readonly getJobsUseCase: GetJobsUseCase.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface,
        private readonly eventBridge: EventBridge.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.handleJobStatus = data => {
            if (data.jobId !== this.currentJobId) {
                return;
            }
            void this.refreshActiveJob(data.referenceId, data.jobId, data.status);
        };

        this.handleJobLog = data => {
            if (data.jobId !== this.currentJobId || !this.currentReferenceId) {
                return;
            }
            runInAction(() => {
                this.upgradesRepository.appendJobLog(this.currentReferenceId!, data.line);
            });
        };

        this.handleReconnect = () => {
            if (this.currentReferenceId && this.currentJobId) {
                void this.refreshActiveJob(this.currentReferenceId, this.currentJobId);
            }
        };

        this.handleJobProgress = data => {
            if (data.jobId !== this.currentJobId || !this.currentReferenceId) {
                return;
            }
            runInAction(() => {
                const activeJob = this.upgradesRepository.getActiveJob(this.currentReferenceId!);
                if (activeJob) {
                    activeJob.progress = data.progress;
                    activeJob.progressLabel = data.progressLabel;
                }
            });
        };
    }

    public get vm(): Abstraction.ViewModel {
        const activeJob = this.currentReferenceId
            ? this.upgradesRepository.getActiveJob(this.currentReferenceId)
            : undefined;

        const history = this.currentReferenceId
            ? this.upgradesRepository.getJobs(this.currentReferenceId)
            : [];

        return {
            activeJob: activeJob
                ? {
                      id: activeJob.id,
                      type: activeJob.type,
                      status: activeJob.status,
                      logs: activeJob.logs ?? "",
                      startedAt: activeJob.startedAt,
                      completedAt: activeJob.completedAt,
                      progress: activeJob.progress ?? null,
                      progressLabel: activeJob.progressLabel ?? null
                  }
                : null,
            history: history.map((job): Abstraction.HistoryJobViewModel => ({
                id: job.id,
                type: job.type,
                status: job.status,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                warning: job.warning
            })),
            tracking: this.tracking
        };
    }

    public trackJob = async (referenceId: string, jobId: string): Promise<void> => {
        this.untrackJob();
        this.currentReferenceId = referenceId;
        this.currentJobId = jobId;
        this.tracking = true;

        this.eventBridge.on("job:status", this.handleJobStatus);
        this.eventBridge.on("job:log", this.handleJobLog);
        this.eventBridge.on("job:progress", this.handleJobProgress);
        this.eventBridge.on("ws:reconnected", this.handleReconnect);

        await this.getJobUseCase.execute(referenceId, jobId);
    };

    public untrackJob = (): void => {
        if (this.tracking) {
            this.eventBridge.off("job:status", this.handleJobStatus);
            this.eventBridge.off("job:log", this.handleJobLog);
            this.eventBridge.off("job:progress", this.handleJobProgress);
            this.eventBridge.off("ws:reconnected", this.handleReconnect);
        }
        this.tracking = false;
        this.currentJobId = null;
    };

    public loadHistory = async (referenceId: string): Promise<void> => {
        this.currentReferenceId = referenceId;
        await this.getJobsUseCase.execute(referenceId);
    };

    private refreshActiveJob = async (
        referenceId: string,
        jobId: string,
        status?: string
    ): Promise<void> => {
        await this.getJobUseCase.execute(referenceId, jobId);

        const resolvedStatus = status ?? this.upgradesRepository.getActiveJob(referenceId)?.status;

        runInAction(() => {
            if (
                resolvedStatus === "completed" ||
                resolvedStatus === "failed" ||
                resolvedStatus === "cancelled" ||
                resolvedStatus === "interrupted"
            ) {
                this.untrackJob();
            }
        });
    };
}

export const JobProgressPresenter = Abstraction.createImplementation({
    implementation: JobProgressPresenterImpl,
    dependencies: [GetJobUseCase, GetJobsUseCase, UpgradesRepository, EventBridge]
});
