import { createAbstraction, Result } from "#shared/index.js";
import type {
    VulnerabilityQueryService,
    VulnerabilityService
} from "#api/services/Vulnerability/index.js";

export interface IGetProjectVulnerabilitiesUseCaseParams {
    projectId: string;
    query: VulnerabilityQueryService.ListQuerystring;
}

export interface IGetProjectVulnerabilitiesUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetProjectVulnerabilitiesUseCase {
    execute(
        params: IGetProjectVulnerabilitiesUseCaseParams
    ): Promise<
        Result<
            VulnerabilityService.EnrichedVulnerabilityResult,
            IGetProjectVulnerabilitiesUseCaseError
        >
    >;
}

export const GetProjectVulnerabilitiesUseCase =
    createAbstraction<IGetProjectVulnerabilitiesUseCase>("Api/GetProjectVulnerabilitiesUseCase");

export namespace GetProjectVulnerabilitiesUseCase {
    export type Interface = IGetProjectVulnerabilitiesUseCase;
    export type Params = IGetProjectVulnerabilitiesUseCaseParams;
    export type Data = VulnerabilityService.EnrichedVulnerabilityResult;
    export type Error = IGetProjectVulnerabilitiesUseCaseError;
}
