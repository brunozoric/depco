import { createAbstraction, Result } from "#shared/index.js";
import type { VulnerabilityQueryService } from "#api/services/Vulnerability/index.js";

export interface IExportVulnerabilitiesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IExportVulnerabilitiesUseCase {
    execute(
        params: VulnerabilityQueryService.ExportQuerystring
    ): Promise<Result<VulnerabilityQueryService.ExportResult, IExportVulnerabilitiesUseCaseError>>;
}

export const ExportVulnerabilitiesUseCase = createAbstraction<IExportVulnerabilitiesUseCase>(
    "Api/ExportVulnerabilitiesUseCase"
);

export namespace ExportVulnerabilitiesUseCase {
    export type Interface = IExportVulnerabilitiesUseCase;
    export type Params = VulnerabilityQueryService.ExportQuerystring;
    export type Data = VulnerabilityQueryService.ExportResult;
    export type Error = IExportVulnerabilitiesUseCaseError;
}
