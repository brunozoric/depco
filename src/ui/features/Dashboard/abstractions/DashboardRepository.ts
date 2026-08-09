import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "./DashboardGateway.js";

export interface IDashboardRepository {
    getHealthResponse(): DashboardGateway.HealthResponse | null;
    setHealthResponse(response: DashboardGateway.HealthResponse): void;
    getTrendResponse(): DashboardGateway.TrendResponse | null;
    setTrendResponse(response: DashboardGateway.TrendResponse): void;
    getActivity(): DashboardGateway.ActivityJob[];
    setActivity(jobs: DashboardGateway.ActivityJob[]): void;
    getStaleness(): DashboardGateway.StalenessProject[];
    setStaleness(projects: DashboardGateway.StalenessProject[]): void;
    getSecurity(): DashboardGateway.SecurityProject[];
    setSecurity(projects: DashboardGateway.SecurityProject[]): void;
    getVulnerabilitySummary(): DashboardGateway.VulnerabilitySummaryResponse | null;
    setVulnerabilitySummary(summary: DashboardGateway.VulnerabilitySummaryResponse): void;
    getVulnerabilityTrend(): DashboardGateway.VulnerabilityTrendPoint[];
    setVulnerabilityTrend(points: DashboardGateway.VulnerabilityTrendPoint[]): void;
    getLicenseComplianceSummary(): DashboardGateway.LicenseComplianceSummary | null;
    setLicenseComplianceSummary(summary: DashboardGateway.LicenseComplianceSummary): void;
    getOpenAutoFixPrCount(): number;
    setOpenAutoFixPrCount(count: number): void;
    getStalenessTrend(): DashboardGateway.StalenessTrendPoint[];
    setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void;
    getLicenseTrend(): DashboardGateway.LicenseTrendPoint[];
    setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void;
    getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[];
    setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void;
}

export const DashboardRepository =
    createAbstraction<IDashboardRepository>("Ui/DashboardRepository");

export namespace DashboardRepository {
    export type Interface = IDashboardRepository;
}
