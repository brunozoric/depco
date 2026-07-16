import { createAbstraction } from "#shared/index.js";
import type { LicensesGateway } from "./LicensesGateway.js";

export interface ILicensesRepository {
    getLicenses(): LicensesGateway.LicenseItem[];
    getLicensesTotal(): number;
    setLicenses(items: LicensesGateway.LicenseItem[], total: number): void;
    getPolicies(): LicensesGateway.PolicyRule[];
    setPolicies(items: LicensesGateway.PolicyRule[]): void;
    getViolations(): LicensesGateway.Violation[];
    getViolationsTotal(): number;
    setViolations(items: LicensesGateway.Violation[], total: number): void;
    getSummary(): LicensesGateway.SummaryData | null;
    setSummary(summary: LicensesGateway.SummaryData): void;
    getViolationsSummary(): LicensesGateway.ViolationsSummaryData | null;
    setViolationsSummary(summary: LicensesGateway.ViolationsSummaryData): void;
}

export const LicensesRepository = createAbstraction<ILicensesRepository>("Ui/LicensesRepository");

export namespace LicensesRepository {
    export type Interface = ILicensesRepository;
}
