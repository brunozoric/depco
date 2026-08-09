import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

export interface ILoadVulnerabilitiesUseCase {
    execute(filters?: VulnerabilitiesGateway.ListFilters): Promise<void>;
}

export const LoadVulnerabilitiesUseCase = createAbstraction<ILoadVulnerabilitiesUseCase>(
    "Ui/LoadVulnerabilitiesUseCase"
);

export namespace LoadVulnerabilitiesUseCase {
    export type Interface = ILoadVulnerabilitiesUseCase;
}
