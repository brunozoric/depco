import { createAbstraction } from "#shared/index.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";

export interface ILicenseInput {
    id: string;
    packageName: string;
    spdxId: string | null;
    licenseName: string;
}

export interface ILicenseViolation {
    licenseId: string;
    ruleId: string;
    projectId: string;
    packageName: string;
    action: Exclude<LicensePolicyAction, "allow">;
}

export interface IComplianceStatus {
    total: number;
    allowed: number;
    warned: number;
    denied: number;
}

export interface ILicensePolicyService {
    /**
     * Evaluates the given license inputs against the project's license
     * policy rules and returns the resulting violations.
     *
     * Side effect: for any license input that already has a corresponding
     * row in the `licenses` table, its violation state is persisted to the
     * `license_violations` table (replacing any prior violations for that
     * license), which is what `getComplianceStatus()` reads from. License
     * inputs with no matching `licenses` row are evaluated in-memory only
     * (e.g. a dry-run) and are not persisted.
     */
    evaluate(projectId: string, licenses: ILicenseInput[]): Promise<ILicenseViolation[]>;
    getComplianceStatus(projectId: string): Promise<IComplianceStatus>;
}

export const LicensePolicyService = createAbstraction<ILicensePolicyService>(
    "Api/LicensePolicyService"
);

export namespace LicensePolicyService {
    export type Interface = ILicensePolicyService;
    export type LicenseInput = ILicenseInput;
    export type Violation = ILicenseViolation;
    export type ComplianceStatus = IComplianceStatus;
}
