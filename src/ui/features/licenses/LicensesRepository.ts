import { LicensesRepository as Abstraction } from "./abstractions/LicensesRepository.js";
import type { LicensesGateway } from "./abstractions/LicensesGateway.js";

class LicensesRepositoryImpl implements Abstraction.Interface {
    private licenses: LicensesGateway.LicenseItem[] = [];
    private licensesTotal = 0;
    private policies: LicensesGateway.PolicyRule[] = [];
    private violations: LicensesGateway.Violation[] = [];
    private violationsTotal = 0;
    private summary: LicensesGateway.SummaryData | null = null;
    private violationsSummary: LicensesGateway.ViolationsSummaryData | null = null;

    public getLicenses(): LicensesGateway.LicenseItem[] {
        return this.licenses;
    }

    public getLicensesTotal(): number {
        return this.licensesTotal;
    }

    public setLicenses(items: LicensesGateway.LicenseItem[], total: number): void {
        this.licenses = items;
        this.licensesTotal = total;
    }

    public getPolicies(): LicensesGateway.PolicyRule[] {
        return this.policies;
    }

    public setPolicies(items: LicensesGateway.PolicyRule[]): void {
        this.policies = items;
    }

    public getViolations(): LicensesGateway.Violation[] {
        return this.violations;
    }

    public getViolationsTotal(): number {
        return this.violationsTotal;
    }

    public setViolations(items: LicensesGateway.Violation[], total: number): void {
        this.violations = items;
        this.violationsTotal = total;
    }

    public getSummary(): LicensesGateway.SummaryData | null {
        return this.summary;
    }

    public setSummary(summary: LicensesGateway.SummaryData): void {
        this.summary = summary;
    }

    public getViolationsSummary(): LicensesGateway.ViolationsSummaryData | null {
        return this.violationsSummary;
    }

    public setViolationsSummary(summary: LicensesGateway.ViolationsSummaryData): void {
        this.violationsSummary = summary;
    }
}

export const LicensesRepository = Abstraction.createImplementation({
    implementation: LicensesRepositoryImpl,
    dependencies: []
});
