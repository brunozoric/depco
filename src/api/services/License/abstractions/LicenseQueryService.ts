import { createAbstraction } from "#shared/index.js";
import type { LicenseRiskTier } from "#shared/licenses/types.js";

export type LicenseSource = "registry" | "license-checker";

export interface ILicenseListFilters {
    projectId?: string | undefined;
    riskTier?: string | undefined;
    spdxId?: string | undefined;
    packageName?: string | undefined;
    teamId?: string | undefined;
    violationAction?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: string | undefined;
}

export interface ILicenseRow {
    id: string;
    projectId: string;
    packageName: string;
    licenseName: string;
    spdxId: string | null;
    source: LicenseSource;
    riskTier: LicenseRiskTier;
    licenseUrl: string | null;
    scannedAt: number;
}

export interface ILicenseListResult {
    items: ILicenseRow[];
    total: number;
}

export interface IProjectLicensesFilters {
    projectId: string;
    riskTier?: string | undefined;
    packageName?: string | undefined;
    teamId?: string | undefined;
}

export interface IProjectLicensesResult {
    items: ILicenseRow[];
    total: number;
}

export interface ILicenseSummaryFilters {
    teamId?: string | undefined;
    projectId?: string | undefined;
}

export interface IRiskTierCounts {
    permissive: number;
    "weak-copyleft": number;
    copyleft: number;
    proprietary: number;
    unknown: number;
}

export interface IViolationActionCounts {
    warn: number;
    deny: number;
}

export interface ILicenseProjectSummary {
    projectId: string;
    projectName: string;
    total: number;
    denied: number;
    warned: number;
}

export interface ILicenseSummary {
    totalPackages: number;
    compliantPercent: number;
    riskTierCounts: IRiskTierCounts;
    violationCounts: IViolationActionCounts;
    projectSummaries: ILicenseProjectSummary[];
}

export interface IViolationListFilters {
    projectId?: string | undefined;
    action?: string | undefined;
    packageName?: string | undefined;
    teamId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}

export interface ILicenseViolationRow {
    id: string;
    licenseId: string;
    ruleId: string;
    projectId: string;
    packageName: string;
    action: string;
    scannedAt: number;
}

export interface IViolationListResult {
    items: ILicenseViolationRow[];
    total: number;
}

export interface IViolationsSummaryFilters {
    teamId?: string | undefined;
}

export interface IViolationProjectSummary {
    projectId: string;
    projectName: string;
    warnCount: number;
    denyCount: number;
}

export interface IViolationsSummary {
    total: number;
    warnCount: number;
    denyCount: number;
    byProject: IViolationProjectSummary[];
}

export interface ILicenseQueryService {
    listLicenses(filters: ILicenseListFilters): Promise<ILicenseListResult>;
    listProjectLicenses(filters: IProjectLicensesFilters): Promise<IProjectLicensesResult>;
    getLicenseSummary(filters: ILicenseSummaryFilters): Promise<ILicenseSummary>;
    listViolations(filters: IViolationListFilters): Promise<IViolationListResult>;
    getViolationsSummary(filters: IViolationsSummaryFilters): Promise<IViolationsSummary>;
}

export const LicenseQueryService =
    createAbstraction<ILicenseQueryService>("Api/LicenseQueryService");

export namespace LicenseQueryService {
    export type Interface = ILicenseQueryService;
    export type ListFilters = ILicenseListFilters;
    export type Row = ILicenseRow;
    export type ListResult = ILicenseListResult;
    export type ProjectListFilters = IProjectLicensesFilters;
    export type ProjectListResult = IProjectLicensesResult;
    export type SummaryFilters = ILicenseSummaryFilters;
    export type RiskTierCounts = IRiskTierCounts;
    export type ViolationActionCounts = IViolationActionCounts;
    export type ProjectSummary = ILicenseProjectSummary;
    export type Summary = ILicenseSummary;
    export type ViolationListFilters = IViolationListFilters;
    export type ViolationRow = ILicenseViolationRow;
    export type ViolationListResult = IViolationListResult;
    export type ViolationsSummaryFilters = IViolationsSummaryFilters;
    export type ViolationProjectSummary = IViolationProjectSummary;
    export type ViolationsSummary = IViolationsSummary;
}
