import { createAbstraction, Result } from "#shared/index.js";
import type {
    VulnerabilityQueryService,
    VulnerabilityService
} from "#api/services/Vulnerability/index.js";

export interface IListVulnerabilitiesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListVulnerabilitiesUseCase {
    execute(
        params: VulnerabilityQueryService.ListQuerystring
    ): Promise<
        Result<VulnerabilityService.EnrichedVulnerabilityResult, IListVulnerabilitiesUseCaseError>
    >;
}

export const ListVulnerabilitiesUseCase = createAbstraction<IListVulnerabilitiesUseCase>(
    "Api/ListVulnerabilitiesUseCase"
);

export namespace ListVulnerabilitiesUseCase {
    export type Interface = IListVulnerabilitiesUseCase;
    export type Params = VulnerabilityQueryService.ListQuerystring;
    export type Data = VulnerabilityService.EnrichedVulnerabilityResult;
    export type Error = IListVulnerabilitiesUseCaseError;
}
