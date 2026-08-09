import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "./VulnerabilitiesGateway.js";

export interface IVulnerabilitiesRepository {
    getVulnerabilities(): VulnerabilitiesGateway.VulnerabilityItem[];
    getTotal(): number;
    getSummary(): VulnerabilitiesGateway.SummaryData | null;
    setVulnerabilities(items: VulnerabilitiesGateway.VulnerabilityItem[], total: number): void;
    setSummary(summary: VulnerabilitiesGateway.SummaryData): void;
    getDetail(): VulnerabilitiesGateway.DetailData | null;
    setDetail(data: VulnerabilitiesGateway.DetailData): void;
}

export const VulnerabilitiesRepository = createAbstraction<IVulnerabilitiesRepository>(
    "Ui/VulnerabilitiesRepository"
);

export namespace VulnerabilitiesRepository {
    export type Interface = IVulnerabilitiesRepository;
}
