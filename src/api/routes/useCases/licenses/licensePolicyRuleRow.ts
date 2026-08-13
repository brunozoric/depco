import type { LicensePolicyAction } from "#shared/licenses/types.js";

export interface ILicensePolicyRuleRow {
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
