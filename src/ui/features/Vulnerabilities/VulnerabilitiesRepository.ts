import { VulnerabilitiesRepository as Abstraction } from "./abstractions/VulnerabilitiesRepository.js";
import type { VulnerabilitiesGateway } from "./abstractions/VulnerabilitiesGateway.js";

class VulnerabilitiesRepositoryImpl implements Abstraction.Interface {
    private vulnerabilities: VulnerabilitiesGateway.VulnerabilityItem[] = [];
    private total = 0;
    private summary: VulnerabilitiesGateway.SummaryData | null = null;
    private detail: VulnerabilitiesGateway.DetailData | null = null;

    public getVulnerabilities(): VulnerabilitiesGateway.VulnerabilityItem[] {
        return this.vulnerabilities;
    }

    public getTotal(): number {
        return this.total;
    }

    public getSummary(): VulnerabilitiesGateway.SummaryData | null {
        return this.summary;
    }

    public setVulnerabilities(
        items: VulnerabilitiesGateway.VulnerabilityItem[],
        total: number
    ): void {
        this.vulnerabilities = items;
        this.total = total;
    }

    public setSummary(summary: VulnerabilitiesGateway.SummaryData): void {
        this.summary = summary;
    }

    public getDetail(): VulnerabilitiesGateway.DetailData | null {
        return this.detail;
    }

    public setDetail(data: VulnerabilitiesGateway.DetailData): void {
        this.detail = data;
    }
}

export const VulnerabilitiesRepository = Abstraction.createImplementation({
    implementation: VulnerabilitiesRepositoryImpl,
    dependencies: []
});
