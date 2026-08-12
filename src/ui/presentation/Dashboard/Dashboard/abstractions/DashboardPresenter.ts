import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";
import type { EnginesGateway } from "../../../../features/Engines/abstractions/EnginesGateway.js";
import type { ChangelogsGateway } from "../../../../features/Changelogs/abstractions/ChangelogsGateway.js";

export interface IDashboardViewModel {
    loading: boolean;
    error: string | null;
    trendRange: string;
    summary: DashboardGateway.HealthSummary | null;
    projects: DashboardGateway.HealthProject[];
    trendData: DashboardGateway.TrendProject[];
    activity: DashboardGateway.ActivityJob[];
    staleness: DashboardGateway.StalenessProject[];
    security: DashboardGateway.SecurityProject[];
    vulnerabilitySummary: DashboardGateway.VulnerabilitySummaryResponse | null;
    vulnerabilityTrend: DashboardGateway.VulnerabilityTrendPoint[];
    vulnerabilityTrendRange: string;
    licenseCompliance: DashboardGateway.LicenseComplianceSummary | null;
    openAutoFixPrCount: number;
    stalenessTrend: DashboardGateway.StalenessTrendPoint[];
    licenseTrend: DashboardGateway.LicenseTrendPoint[];
    autoFixTrend: DashboardGateway.AutoFixTrendPoint[];
    scoreModalProjectId: string | null;
    scoreDetailLoading: boolean;
    scoreDetail: DashboardGateway.ScoreDetailResponse | null;
    engineSummary: EnginesGateway.SummaryData | null;
    changelogStats: ChangelogsGateway.Stats | null;
    reResolvingChangelogs: boolean;
}

export interface IDashboardPresenter {
    get vm(): IDashboardViewModel;
    load: () => Promise<void>;
    setTrendRange: (range: string) => void;
    setVulnerabilityTrendRange: (range: string) => void;
    openScoreModal: (projectId: string) => void;
    closeScoreModal: () => void;
    reResolveAllChangelogs: () => Promise<void>;
    dispose: () => void;
}

export const DashboardPresenter = createAbstraction<IDashboardPresenter>("Ui/DashboardPresenter");

export namespace DashboardPresenter {
    export type Interface = IDashboardPresenter;
    export type ViewModel = IDashboardViewModel;
}
