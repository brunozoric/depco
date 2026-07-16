import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "../../../../features/vulnerabilities/abstractions/VulnerabilitiesGateway.js";

export interface IScanVulnerabilitiesUseCase {
    execute(projectId: string): Promise<VulnerabilitiesGateway.ScanResult>;
}

export const ScanVulnerabilitiesUseCase = createAbstraction<IScanVulnerabilitiesUseCase>(
    "Ui/ScanVulnerabilitiesUseCase"
);

export namespace ScanVulnerabilitiesUseCase {
    export type Interface = IScanVulnerabilitiesUseCase;
}
