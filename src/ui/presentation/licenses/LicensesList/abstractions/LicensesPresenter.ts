import { createAbstraction } from "#shared/index.js";
import type { LicenseRiskTier, LicensePolicyAction } from "#shared/licenses/types.js";
import type { LicensesGateway } from "../../../../features/licenses/abstractions/LicensesGateway.js";

export interface ILicenseRowViewModel {
    id: string;
    projectId: string;
    projectName: string;
    packageName: string;
    licenseName: string;
    spdxId: string | null;
    riskTier: LicenseRiskTier;
    source: string;
    violationAction: "warn" | "deny" | null;
}

export interface IPolicyRuleViewModel {
    id: string;
    action: LicensePolicyAction;
    licensePattern: string | null;
    packagePattern: string | null;
    projectId: string | null;
    priority: number;
    reason: string | null;
}

export interface IComplianceSummaryViewModel {
    totalPackages: number;
    compliantPercent: number;
    riskTierCounts: Record<LicenseRiskTier, number>;
    warnCount: number;
    denyCount: number;
}

export interface IProjectOption {
    id: string;
    name: string;
}

export interface ILicensesViewModel {
    loading: boolean;
    error: string | null;
    licenses: ILicenseRowViewModel[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    sortBy: string;
    sortOrder: string;
    summary: IComplianceSummaryViewModel | null;
    policyRules: IPolicyRuleViewModel[];
    availableProjects: IProjectOption[];
    riskTierFilter: string | null;
    packageNameFilter: string;
    projectIdFilter: string | null;
    violationFilter: string | null;
}

export interface ILicensesPresenter {
    get vm(): ILicensesViewModel;
    load(): Promise<void>;
    setRiskTierFilter(tier: string | null): void;
    setPackageNameFilter(name: string): void;
    setProjectIdFilter(projectId: string | null): void;
    setViolationFilter(action: string | null): void;
    setPage(page: number): void;
    setSortBy(sortBy: string): void;
    createRule(input: LicensesGateway.CreatePolicyInput): Promise<void>;
    updateRule(id: string, input: LicensesGateway.UpdatePolicyInput): Promise<void>;
    deleteRule(id: string): Promise<void>;
    scanProject(projectId: string): Promise<void>;
    dispose(): void;
}

export const LicensesPresenter = createAbstraction<ILicensesPresenter>("Ui/LicensesPresenter");

export namespace LicensesPresenter {
    export type Interface = ILicensesPresenter;
    export type ViewModel = ILicensesViewModel;
    export type LicenseRow = ILicenseRowViewModel;
    export type PolicyRule = IPolicyRuleViewModel;
    export type ComplianceSummary = IComplianceSummaryViewModel;
}
