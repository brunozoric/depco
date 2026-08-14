import { createAbstraction } from "#shared/index.js";
import type { LicenseRiskTier, LicensePolicyAction } from "#shared/licenses/types.js";

export interface ILicenseItem {
    id: string;
    projectId: string;
    packageName: string;
    licenseName: string;
    spdxId: string | null;
    source: "registry" | "license-checker";
    riskTier: LicenseRiskTier;
    licenseUrl: string | null;
    scannedAt: number;
}

export interface ILicensePolicyRule {
    id: string;
    action: LicensePolicyAction;
    licensePattern: string | null;
    packagePattern: string | null;
    projectId: string | null;
    priority: number;
    reason: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ILicenseViolation {
    id: string;
    licenseId: string;
    ruleId: string;
    projectId: string;
    packageName: string;
    action: string;
    scannedAt: number;
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

export interface ILicenseProjectSummary {
    projectId: string;
    projectName: string;
    total: number;
    denied: number;
    warned: number;
}

export interface ILicenseSummaryData {
    totalPackages: number;
    compliantPercent: number;
    riskTierCounts: ILicenseRiskTierCounts;
    violationCounts: ILicenseViolationCounts;
    projectSummaries: ILicenseProjectSummary[];
}

export interface ILicenseListFilters {
    projectId?: string;
    riskTier?: string;
    packageName?: string;
    spdxId?: string;
    teamId?: string;
    violationAction?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
}

export interface ILicenseListResponse {
    items: ILicenseItem[];
    total: number;
}

export interface ILicenseScanResult {
    jobId: string;
}

export interface ILicensePolicyListFilters {
    projectId?: string;
}

export interface ILicensePolicyListResponse {
    items: ILicensePolicyRule[];
}

export interface ICreateLicensePolicyInput {
    action: LicensePolicyAction;
    licensePattern?: string | null;
    packagePattern?: string | null;
    projectId?: string | null;
    priority: number;
    reason?: string | null;
}

export interface IUpdateLicensePolicyInput {
    action?: LicensePolicyAction;
    licensePattern?: string | null;
    packagePattern?: string | null;
    projectId?: string | null;
    priority?: number;
    reason?: string | null;
}

export interface IDeleteLicensePolicyResult {
    deleted: boolean;
}

export interface ILicenseViolationListFilters {
    projectId?: string;
    action?: string;
    packageName?: string;
    teamId?: string;
}

export interface ILicenseViolationListResponse {
    items: ILicenseViolation[];
    total: number;
}

export interface ILicenseViolationsByProject {
    projectId: string;
    projectName: string;
    warnCount: number;
    denyCount: number;
}

export interface IViolationsSummaryData {
    total: number;
    warnCount: number;
    denyCount: number;
    byProject: ILicenseViolationsByProject[];
}

export interface ILicensesGateway {
    list(filters?: ILicenseListFilters): Promise<ILicenseListResponse>;
    getByProject(projectId: string, filters?: ILicenseListFilters): Promise<ILicenseListResponse>;
    getSummary(teamId?: string, projectId?: string): Promise<ILicenseSummaryData>;
    scan(projectId: string): Promise<ILicenseScanResult>;
    listPolicies(filters?: ILicensePolicyListFilters): Promise<ILicensePolicyListResponse>;
    createPolicy(input: ICreateLicensePolicyInput): Promise<ILicensePolicyRule>;
    updatePolicy(id: string, input: IUpdateLicensePolicyInput): Promise<ILicensePolicyRule>;
    deletePolicy(id: string): Promise<IDeleteLicensePolicyResult>;
    listViolations(filters?: ILicenseViolationListFilters): Promise<ILicenseViolationListResponse>;
    getViolationsSummary(teamId?: string): Promise<IViolationsSummaryData>;
}

export const LicensesGateway = createAbstraction<ILicensesGateway>("Ui/LicensesGateway");

export namespace LicensesGateway {
    export type Interface = ILicensesGateway;
    export type LicenseItem = ILicenseItem;
    export type PolicyRule = ILicensePolicyRule;
    export type Violation = ILicenseViolation;
    export type RiskTierCounts = ILicenseRiskTierCounts;
    export type ViolationCounts = ILicenseViolationCounts;
    export type ProjectSummary = ILicenseProjectSummary;
    export type SummaryData = ILicenseSummaryData;
    export type ListFilters = ILicenseListFilters;
    export type ListResponse = ILicenseListResponse;
    export type ScanResult = ILicenseScanResult;
    export type PolicyListFilters = ILicensePolicyListFilters;
    export type PolicyListResponse = ILicensePolicyListResponse;
    export type CreatePolicyInput = ICreateLicensePolicyInput;
    export type UpdatePolicyInput = IUpdateLicensePolicyInput;
    export type DeletePolicyResult = IDeleteLicensePolicyResult;
    export type ViolationListFilters = ILicenseViolationListFilters;
    export type ViolationListResponse = ILicenseViolationListResponse;
    export type ViolationsByProject = ILicenseViolationsByProject;
    export type ViolationsSummaryData = IViolationsSummaryData;
}
