import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export interface IVulnerabilityItem {
    id: string;
    projectId: string;
    projectName: string;
    packageName: string;
    severity: VulnerabilitySeverity;
    title: string;
    advisoryUrl: string | null;
    cveId: string | null;
    vulnerableRange: string | null;
    fixVersion: string | null;
    source: "audit" | "osv" | "both";
    installedVersion: string | null;
    dependencyKind: string;
    scannedAt: number;
    dismissedAt: number | null;
    dismissedUntil: number | null;
}

export interface IProjectVulnerabilitySummary {
    projectId: string;
    projectName: string;
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
}

export interface IVulnerabilitySummaryData {
    totalVulnerabilities: number;
    counts: Record<VulnerabilitySeverity, number>;
    projectSummaries: IProjectVulnerabilitySummary[];
}

export interface IVulnerabilityListFilters {
    severity?: string;
    packageName?: string;
    source?: string;
    projectIds?: string[];
    includeDismissed?: boolean;
    scannedDate?: string;
    teamId?: string;
    dependencyType?: "all" | "direct" | "transitive";
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
}

export interface IVulnerabilityListResponse {
    items: IVulnerabilityItem[];
    total: number;
}

export interface IVulnerabilityScanResult {
    total: number;
    counts: Record<VulnerabilitySeverity, number>;
}

export interface IVulnerabilityRefreshOptions {
    packageName?: string;
    packageNames?: string[];
    all?: boolean;
    olderThanMs?: number;
    newerThanMs?: number;
}

export interface IOsvReferenceView {
    type: string;
    url: string;
}

export interface IOsvAffectedVersionView {
    introduced: string | null;
    fixed: string | null;
    lastAffected: string | null;
}

export interface IOsvEnrichedDetailView {
    description: string | null;
    references: IOsvReferenceView[];
    affectedVersions: IOsvAffectedVersionView[];
    cvssScore: number | null;
    cvssVector: string | null;
    aliases: string[];
}

export interface IVulnerabilityDetailItem extends IVulnerabilityItem {
    dedupKey: string;
}

export interface IVulnerabilityDetailData {
    vulnerability: IVulnerabilityDetailItem;
    osvDetail: IOsvEnrichedDetailView | null;
}

export interface IExpiredSnoozesData {
    count: number;
    packageNames: string[];
}

export interface IVulnerabilityBulkActionParams {
    ids: string[];
    action: "dismiss" | "snooze" | "undismiss";
    snoozeDays?: 7 | 30 | 90;
}

export interface IVulnerabilityExportParams {
    filters: IVulnerabilityListFilters;
    format: "csv" | "json";
    ids?: string[];
    teamId?: string;
}

export interface IVulnerabilitiesGateway {
    list(filters?: IVulnerabilityListFilters): Promise<IVulnerabilityListResponse>;
    getByProject(
        projectId: string,
        filters?: IVulnerabilityListFilters
    ): Promise<IVulnerabilityListResponse>;
    getSummary(teamId?: string): Promise<IVulnerabilitySummaryData>;
    scan(projectId: string): Promise<IVulnerabilityScanResult>;
    refreshOsvCache(options: IVulnerabilityRefreshOptions): Promise<{ invalidated: number }>;
    bulkAction(params: IVulnerabilityBulkActionParams): Promise<{ updatedCount: number }>;
    bulkRescan(ids: string[]): Promise<{ projectsQueued: number }>;
    getExportUrl(params: IVulnerabilityExportParams): string;
    getDetail(vulnerabilityId: string): Promise<IVulnerabilityDetailData>;
    getExpiredSnoozes(sinceMs: number): Promise<IExpiredSnoozesData>;
}

export const VulnerabilitiesGateway = createAbstraction<IVulnerabilitiesGateway>(
    "Ui/VulnerabilitiesGateway"
);

export namespace VulnerabilitiesGateway {
    export type Interface = IVulnerabilitiesGateway;
    export type VulnerabilityItem = IVulnerabilityItem;
    export type ProjectSummary = IProjectVulnerabilitySummary;
    export type SummaryData = IVulnerabilitySummaryData;
    export type ListFilters = IVulnerabilityListFilters;
    export type ListResponse = IVulnerabilityListResponse;
    export type ScanResult = IVulnerabilityScanResult;
    export type RefreshOptions = IVulnerabilityRefreshOptions;
    export type DetailData = IVulnerabilityDetailData;
    export type DetailItem = IVulnerabilityDetailItem;
    export type ExpiredSnoozesData = IExpiredSnoozesData;
    export type BulkActionParams = IVulnerabilityBulkActionParams;
    export type ExportParams = IVulnerabilityExportParams;
    export type OsvDetail = IOsvEnrichedDetailView;
    export type OsvReference = IOsvReferenceView;
    export type OsvAffectedVersion = IOsvAffectedVersionView;
}
