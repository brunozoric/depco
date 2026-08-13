import { createAbstraction, Result } from "#shared/index.js";
import type { LicenseQueryService } from "#api/services/License/index.js";

export interface IGetLicenseSummaryUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetLicenseSummaryUseCase {
    execute(
        params: LicenseQueryService.SummaryFilters
    ): Promise<Result<LicenseQueryService.Summary, IGetLicenseSummaryUseCaseError>>;
}

export const GetLicenseSummaryUseCase = createAbstraction<IGetLicenseSummaryUseCase>(
    "Api/GetLicenseSummaryUseCase"
);

export namespace GetLicenseSummaryUseCase {
    export type Interface = IGetLicenseSummaryUseCase;
    export type Params = LicenseQueryService.SummaryFilters;
    export type Data = LicenseQueryService.Summary;
    export type Error = IGetLicenseSummaryUseCaseError;
}
