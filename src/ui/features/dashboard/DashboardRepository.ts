import { DashboardRepository as Abstraction } from "./abstractions/DashboardRepository.js";
import type { DashboardGateway } from "./abstractions/DashboardGateway.js";

class DashboardRepositoryImpl implements Abstraction.Interface {
    private healthResponse: DashboardGateway.HealthResponse | null = null;
    private trendResponse: DashboardGateway.TrendResponse | null = null;
    private activity: DashboardGateway.ActivityJob[] = [];
    private staleness: DashboardGateway.StalenessProject[] = [];
    private security: DashboardGateway.SecurityProject[] = [];
    private vulnerabilitySummary: DashboardGateway.VulnerabilitySummaryResponse | null = null;
    private vulnerabilityTrend: DashboardGateway.VulnerabilityTrendPoint[] = [];
    private licenseComplianceSummary: DashboardGateway.LicenseComplianceSummary | null = null;
    private openAutoFixPrCount = 0;
    private stalenessTrend: DashboardGateway.StalenessTrendPoint[] = [];
    private licenseTrend: DashboardGateway.LicenseTrendPoint[] = [];
    private autoFixTrend: DashboardGateway.AutoFixTrendPoint[] = [];

    public getHealthResponse(): DashboardGateway.HealthResponse | null {
        return this.healthResponse;
    }

    public setHealthResponse(response: DashboardGateway.HealthResponse): void {
        this.healthResponse = response;
    }

    public getTrendResponse(): DashboardGateway.TrendResponse | null {
        return this.trendResponse;
    }

    public setTrendResponse(response: DashboardGateway.TrendResponse): void {
        this.trendResponse = response;
    }

    public getActivity(): DashboardGateway.ActivityJob[] {
        return this.activity;
    }

    public setActivity(jobs: DashboardGateway.ActivityJob[]): void {
        this.activity = jobs;
    }

    public getStaleness(): DashboardGateway.StalenessProject[] {
        return this.staleness;
    }

    public setStaleness(projects: DashboardGateway.StalenessProject[]): void {
        this.staleness = projects;
    }

    public getSecurity(): DashboardGateway.SecurityProject[] {
        return this.security;
    }

    public setSecurity(projects: DashboardGateway.SecurityProject[]): void {
        this.security = projects;
    }

    public getVulnerabilitySummary(): DashboardGateway.VulnerabilitySummaryResponse | null {
        return this.vulnerabilitySummary;
    }

    public setVulnerabilitySummary(summary: DashboardGateway.VulnerabilitySummaryResponse): void {
        this.vulnerabilitySummary = summary;
    }

    public getVulnerabilityTrend(): DashboardGateway.VulnerabilityTrendPoint[] {
        return this.vulnerabilityTrend;
    }

    public setVulnerabilityTrend(points: DashboardGateway.VulnerabilityTrendPoint[]): void {
        this.vulnerabilityTrend = points;
    }

    public getLicenseComplianceSummary(): DashboardGateway.LicenseComplianceSummary | null {
        return this.licenseComplianceSummary;
    }

    public setLicenseComplianceSummary(summary: DashboardGateway.LicenseComplianceSummary): void {
        this.licenseComplianceSummary = summary;
    }

    public getOpenAutoFixPrCount(): number {
        return this.openAutoFixPrCount;
    }

    public setOpenAutoFixPrCount(count: number): void {
        this.openAutoFixPrCount = count;
    }

    public getStalenessTrend(): DashboardGateway.StalenessTrendPoint[] {
        return this.stalenessTrend;
    }

    public setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void {
        this.stalenessTrend = points;
    }

    public getLicenseTrend(): DashboardGateway.LicenseTrendPoint[] {
        return this.licenseTrend;
    }

    public setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void {
        this.licenseTrend = points;
    }

    public getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[] {
        return this.autoFixTrend;
    }

    public setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void {
        this.autoFixTrend = points;
    }
}

export const DashboardRepository = Abstraction.createImplementation({
    implementation: DashboardRepositoryImpl,
    dependencies: []
});
