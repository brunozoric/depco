import { LoadDashboardUseCase as Abstraction } from "./abstractions/LoadDashboardUseCase.js";
import { DashboardGateway } from "../../../features/Dashboard/abstractions/DashboardGateway.js";
import { DashboardRepository } from "../../../features/Dashboard/abstractions/DashboardRepository.js";

class LoadDashboardUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: DashboardGateway.Interface,
        private readonly repository: DashboardRepository.Interface
    ) {}

    public execute = async ({ trendRange, teamId }: Abstraction.Params): Promise<void> => {
        const [
            health,
            trend,
            activity,
            staleness,
            security,
            vulnerabilitySummary,
            licenseSummary,
            openAutoFixPrCount,
            stalenessTrend,
            licenseTrend,
            autoFixTrend
        ] = await Promise.all([
            this.gateway.getHealth(teamId),
            this.gateway.getTrend({ range: trendRange, ...(teamId ? { teamId } : {}) }),
            this.gateway.getActivity(teamId),
            this.gateway.getStaleness(teamId),
            this.gateway.getSecurity(teamId),
            this.gateway.getVulnerabilitySummary(teamId),
            this.gateway.getLicenseSummary(teamId),
            this.gateway.getOpenAutoFixPrCount(teamId),
            this.gateway.getStalenessTrend({ days: "7", ...(teamId ? { teamId } : {}) }),
            this.gateway.getLicenseTrend({ days: "7", ...(teamId ? { teamId } : {}) }),
            this.gateway.getAutoFixTrend({ days: "7", ...(teamId ? { teamId } : {}) })
        ]);

        this.repository.setHealthResponse(health);
        this.repository.setTrendResponse(trend);
        this.repository.setActivity(activity.items);
        this.repository.setStaleness(staleness.items);
        this.repository.setSecurity(security.items);
        this.repository.setVulnerabilitySummary(vulnerabilitySummary);
        this.repository.setLicenseComplianceSummary(licenseSummary);
        this.repository.setOpenAutoFixPrCount(openAutoFixPrCount);
        this.repository.setStalenessTrend(stalenessTrend.points);
        this.repository.setLicenseTrend(licenseTrend.points);
        this.repository.setAutoFixTrend(autoFixTrend.points);
    };

    public refreshHealth = async (teamId?: string): Promise<void> => {
        const [health, staleness] = await Promise.all([
            this.gateway.getHealth(teamId),
            this.gateway.getStaleness(teamId)
        ]);
        this.repository.setHealthResponse(health);
        this.repository.setStaleness(staleness.items);
    };

    public refreshActivity = async (): Promise<void> => {
        const activity = await this.gateway.getActivity();
        this.repository.setActivity(activity.items);
    };
}

export const LoadDashboardUseCase = Abstraction.createImplementation({
    implementation: LoadDashboardUseCaseImpl,
    dependencies: [DashboardGateway, DashboardRepository]
});
