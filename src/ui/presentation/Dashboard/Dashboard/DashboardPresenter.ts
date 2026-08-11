import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
import { DashboardPresenter as Abstraction } from "./abstractions/DashboardPresenter.js";
import { DashboardRepository } from "../../../features/Dashboard/abstractions/DashboardRepository.js";
import { LoadDashboardUseCase } from "../useCases/abstractions/LoadDashboardUseCase.js";
import { LoadVulnerabilityTrendUseCase } from "../useCases/abstractions/LoadVulnerabilityTrendUseCase.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";
import { DashboardGateway } from "../../../features/Dashboard/abstractions/DashboardGateway.js";
import { EnginesGateway } from "../../../features/Engines/abstractions/EnginesGateway.js";
import { EnginesRepository } from "../../../features/Engines/abstractions/EnginesRepository.js";
import { getErrorMessage } from "#shared/errors.js";

type VulnerabilityTrendDays = 7 | 30 | 90 | undefined;

function toVulnerabilityTrendDays(range: string): VulnerabilityTrendDays {
    return range === "all" ? undefined : (Number(range.replace("d", "")) as VulnerabilityTrendDays);
}

class DashboardPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private trendRange = "30d";
    private vulnerabilityTrendRange = "30d";
    private scoreModalProjectId: string | null = null;
    private scoreDetailLoading = false;
    private scoreDetail: DashboardGateway.ScoreDetailResponse | null = null;
    private readonly disposeTeamReaction: () => void;

    private readonly handleScanComplete = (): void => {
        const teamId = this.teamFilterService.selectedTeamId ?? undefined;
        this.loadDashboard.refreshHealth(teamId).catch(() => {});
    };

    private readonly handleJobStatus = (): void => {
        this.loadDashboard.refreshActivity().catch(() => {});
    };

    private readonly handleEngineScanComplete = (): void => {
        this.loadEngineSummary().catch(() => {});
    };

    public constructor(
        private readonly repository: DashboardRepository.Interface,
        private readonly loadDashboard: LoadDashboardUseCase.Interface,
        private readonly loadVulnerabilityTrendUseCase: LoadVulnerabilityTrendUseCase.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        private readonly dashboardGateway: DashboardGateway.Interface,
        private readonly enginesGateway: EnginesGateway.Interface,
        private readonly enginesRepository: EnginesRepository.Interface
    ) {
        makeAutoObservable(this, { vm: computed });

        this.eventBridge.on("scan:complete", this.handleScanComplete);
        this.eventBridge.on("job:status", this.handleJobStatus);
        this.eventBridge.on("engine-scan:complete", this.handleEngineScanComplete);

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );
    }

    public get vm(): Abstraction.ViewModel {
        const healthResponse = this.repository.getHealthResponse();
        const trendResponse = this.repository.getTrendResponse();

        return {
            loading: this.loading,
            error: this.error,
            trendRange: this.trendRange,
            summary: healthResponse?.summary ?? null,
            projects: healthResponse?.projects ?? [],
            trendData: trendResponse?.items ?? [],
            activity: this.repository.getActivity(),
            staleness: this.repository.getStaleness(),
            security: this.repository.getSecurity(),
            vulnerabilitySummary: this.repository.getVulnerabilitySummary(),
            vulnerabilityTrend: this.repository.getVulnerabilityTrend(),
            vulnerabilityTrendRange: this.vulnerabilityTrendRange,
            licenseCompliance: this.repository.getLicenseComplianceSummary(),
            openAutoFixPrCount: this.repository.getOpenAutoFixPrCount(),
            stalenessTrend: this.repository.getStalenessTrend(),
            licenseTrend: this.repository.getLicenseTrend(),
            autoFixTrend: this.repository.getAutoFixTrend(),
            scoreModalProjectId: this.scoreModalProjectId,
            scoreDetailLoading: this.scoreDetailLoading,
            scoreDetail: this.scoreDetail,
            engineSummary: this.enginesRepository.getSummary()
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            const teamId = this.teamFilterService.selectedTeamId ?? undefined;
            await Promise.all([
                this.loadDashboard.execute({
                    trendRange: this.trendRange,
                    ...(teamId ? { teamId } : {})
                }),
                this.loadVulnerabilityTrend(),
                this.loadEngineSummary()
            ]);
        } catch (err) {
            runInAction(() => {
                this.error = getErrorMessage(err, "Failed to load dashboard");
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setTrendRange = (range: string): void => {
        this.trendRange = range;
        void this.load();
    };

    public setVulnerabilityTrendRange = (range: string): void => {
        this.vulnerabilityTrendRange = range;
        this.loadVulnerabilityTrend().catch(() => {});
    };

    private loadVulnerabilityTrend = async (): Promise<void> => {
        const teamId = this.teamFilterService.selectedTeamId ?? undefined;
        const days = toVulnerabilityTrendDays(this.vulnerabilityTrendRange);
        await this.loadVulnerabilityTrendUseCase.execute({
            ...(days ? { days } : {}),
            ...(teamId ? { teamId } : {})
        });
    };

    private loadEngineSummary = async (): Promise<void> => {
        const summary = await this.enginesGateway.getSummary();
        runInAction(() => {
            this.enginesRepository.setSummary(summary);
        });
    };

    public openScoreModal = async (projectId: string): Promise<void> => {
        this.scoreModalProjectId = projectId;
        this.scoreDetail = null;
        this.scoreDetailLoading = true;
        try {
            const detail = await this.dashboardGateway.getScoreDetail(projectId);
            runInAction(() => {
                if (this.scoreModalProjectId !== projectId) {
                    return;
                }
                this.scoreDetail = detail;
                this.scoreDetailLoading = false;
            });
        } catch {
            runInAction(() => {
                if (this.scoreModalProjectId !== projectId) {
                    return;
                }
                this.scoreDetailLoading = false;
            });
        }
    };

    public closeScoreModal = (): void => {
        this.scoreModalProjectId = null;
        this.scoreDetail = null;
        this.scoreDetailLoading = false;
    };

    public dispose = (): void => {
        this.eventBridge.off("scan:complete", this.handleScanComplete);
        this.eventBridge.off("job:status", this.handleJobStatus);
        this.eventBridge.off("engine-scan:complete", this.handleEngineScanComplete);
        this.disposeTeamReaction();
    };
}

export const DashboardPresenter = Abstraction.createImplementation({
    implementation: DashboardPresenterImpl,
    dependencies: [
        DashboardRepository,
        LoadDashboardUseCase,
        LoadVulnerabilityTrendUseCase,
        EventBridge,
        TeamFilterService,
        DashboardGateway,
        EnginesGateway,
        EnginesRepository
    ]
});
