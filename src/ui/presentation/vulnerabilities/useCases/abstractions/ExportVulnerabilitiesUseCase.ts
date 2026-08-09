import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

export interface IExportVulnerabilitiesParams {
    filters: VulnerabilitiesGateway.ListFilters;
    format: "csv" | "json";
    ids?: string[];
    teamId?: string;
}

export interface IExportVulnerabilitiesUseCase {
    execute(params: IExportVulnerabilitiesParams): void;
}

export const ExportVulnerabilitiesUseCase = createAbstraction<IExportVulnerabilitiesUseCase>(
    "Ui/ExportVulnerabilitiesUseCase"
);

export namespace ExportVulnerabilitiesUseCase {
    export type Interface = IExportVulnerabilitiesUseCase;
    export type Params = IExportVulnerabilitiesParams;
}
