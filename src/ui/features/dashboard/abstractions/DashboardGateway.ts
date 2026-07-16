import { createAbstraction } from "#shared/index.js";

export interface IHealthProject {
    projectId: string;
    projectName: string;
    score: number;
    scoreDelta: number | null;
    totalPackages: number;
    upToDate: number;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    lastScannedAt: number | null;
    vulnerabilityCritical: number;
    vulnerabilityHigh: number;
    vulnerabilityModerate: number;
    vulnerabilityLow: number;
}

export interface IWorstProject {
    id: string;
    name: string;
    score: number;
    totalPackages: number;
    upToDate: number;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
}

export interface IHealthSummary {
    totalProjects: number;
    averageScore: number;
    worstProject: IWorstProject | null;
}

export interface IHealthResponse {
    summary: IHealthSummary;
    projects: IHealthProject[];
}

export interface ITrendSnapshot {
    date: string;
    score: number;
}

export interface ITrendProject {
    projectId: string;
    projectName: string;
    snapshots: ITrendSnapshot[];
}

export interface ITrendResponse {
    items: ITrendProject[];
}

export interface IActivityJob {
    id: string;
    type: string;
    referenceId: string;
    referenceType: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
}

export interface IStalenessProject {
    projectId: string;
    projectName: string;
    lastScannedAt: number | null;
}

export interface ISecurityProject {
    projectId: string;
    projectName: string;
    totalChecks: number;
    passingChecks: number;
}

export interface IActivityResponse {
    items: IActivityJob[];
}

export interface IStalenessResponse {
    items: IStalenessProject[];
}

export interface ISecurityResponse {
    items: ISecurityProject[];
}

export interface IVulnerabilitySummaryProject {
    projectId: string;
    projectName: string;
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
}

export interface IVulnerabilitySummaryResponse {
    totalVulnerabilities: number;
    counts: {
        critical: number;
        high: number;
        moderate: number;
        low: number;
        info: number;
    };
    transitiveCount: number;
    directCount: number;
    projectSummaries: IVulnerabilitySummaryProject[];
}

export interface IVulnerabilityTrendPoint {
    date: string;
    critical: number;
    high: number;
    moderate: number;
    low: number;
}

export interface IVulnerabilityTrendResponse {
    points: IVulnerabilityTrendPoint[];
}

export interface ILicenseRiskTierCounts {
    permissive: number;
    "weak-copyleft": number;
    copyleft: number;
    proprietary: number;
    unknown: number;
}

export interface ILicenseViolationCounts {
    warn: number;
    deny: number;
}

export interface ILicenseComplianceSummary {
    totalPackages: number;
    compliantPercent: number;
    riskTierCounts: ILicenseRiskTierCounts;
    violationCounts: ILicenseViolationCounts;
}

export interface IStalenessTrendPoint {
    date: string;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    totalPackages: number;
}

export interface ILicenseTrendPoint {
    date: string;
    compliantCount: number;
    deniedCount: number;
    warnedCount: number;
    totalPackages: number;
}

export interface IAutoFixTrendPoint {
    date: string;
    pending: number;
    created: number;
    merged: number;
    closed: number;
    failed: number;
}

export interface IStalenessTrendResponse {
    points: IStalenessTrendPoint[];
}

export interface ILicenseTrendResponse {
    points: ILicenseTrendPoint[];
}

export interface IAutoFixTrendResponse {
    points: IAutoFixTrendPoint[];
}

export interface IDashboardTrendParams {
    range: string;
    teamId?: string;
}

export interface IDashboardVulnerabilityTrendParams {
    days?: 7 | 30 | 90;
    teamId?: string;
}

export interface IDashboardSparklineTrendParams {
    days?: string;
    teamId?: string;
}

export interface IScoreDetailOutdatedPackage {
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: "major" | "minor" | "patch";
}

export interface IScoreDetailVulnerability {
    packageName: string;
    severity: "critical" | "high" | "moderate" | "low";
    title: string;
    fixVersion: string | null;
    penalty: number;
}

export interface IScoreDetailResponse {
    outdatedPackages: IScoreDetailOutdatedPackage[];
    vulnerabilities: IScoreDetailVulnerability[];
}

export interface IDashboardGateway {
    getHealth(teamId?: string): Promise<IHealthResponse>;
    getTrend(params: IDashboardTrendParams): Promise<ITrendResponse>;
    getActivity(teamId?: string): Promise<IActivityResponse>;
    getStaleness(teamId?: string): Promise<IStalenessResponse>;
    getSecurity(teamId?: string): Promise<ISecurityResponse>;
    getVulnerabilitySummary(teamId?: string): Promise<IVulnerabilitySummaryResponse>;
    getVulnerabilityTrend(
        params?: IDashboardVulnerabilityTrendParams
    ): Promise<IVulnerabilityTrendResponse>;
    getLicenseSummary(teamId?: string): Promise<ILicenseComplianceSummary>;
    getOpenAutoFixPrCount(teamId?: string): Promise<number>;
    getStalenessTrend(params?: IDashboardSparklineTrendParams): Promise<IStalenessTrendResponse>;
    getLicenseTrend(params?: IDashboardSparklineTrendParams): Promise<ILicenseTrendResponse>;
    getAutoFixTrend(params?: IDashboardSparklineTrendParams): Promise<IAutoFixTrendResponse>;
    getScoreDetail(projectId: string): Promise<IScoreDetailResponse>;
}

export const DashboardGateway = createAbstraction<IDashboardGateway>("Ui/DashboardGateway");

export namespace DashboardGateway {
    export type Interface = IDashboardGateway;
    export type HealthResponse = IHealthResponse;
    export type HealthProject = IHealthProject;
    export type WorstProject = IWorstProject;
    export type HealthSummary = IHealthSummary;
    export type TrendResponse = ITrendResponse;
    export type TrendProject = ITrendProject;
    export type TrendSnapshot = ITrendSnapshot;
    export type ActivityJob = IActivityJob;
    export type ActivityResponse = IActivityResponse;
    export type StalenessProject = IStalenessProject;
    export type StalenessResponse = IStalenessResponse;
    export type SecurityProject = ISecurityProject;
    export type SecurityResponse = ISecurityResponse;
    export type VulnerabilitySummaryProject = IVulnerabilitySummaryProject;
    export type VulnerabilitySummaryResponse = IVulnerabilitySummaryResponse;
    export type VulnerabilityTrendPoint = IVulnerabilityTrendPoint;
    export type VulnerabilityTrendResponse = IVulnerabilityTrendResponse;
    export type LicenseRiskTierCounts = ILicenseRiskTierCounts;
    export type LicenseViolationCounts = ILicenseViolationCounts;
    export type LicenseComplianceSummary = ILicenseComplianceSummary;
    export type StalenessTrendPoint = IStalenessTrendPoint;
    export type LicenseTrendPoint = ILicenseTrendPoint;
    export type AutoFixTrendPoint = IAutoFixTrendPoint;
    export type TrendParams = IDashboardTrendParams;
    export type VulnerabilityTrendParams = IDashboardVulnerabilityTrendParams;
    export type SparklineTrendParams = IDashboardSparklineTrendParams;
    export type StalenessTrendResponse = IStalenessTrendResponse;
    export type LicenseTrendResponse = ILicenseTrendResponse;
    export type AutoFixTrendResponse = IAutoFixTrendResponse;
    export type ScoreDetailOutdatedPackage = IScoreDetailOutdatedPackage;
    export type ScoreDetailVulnerability = IScoreDetailVulnerability;
    export type ScoreDetailResponse = IScoreDetailResponse;
}
