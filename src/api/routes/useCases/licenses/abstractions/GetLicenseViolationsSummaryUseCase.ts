import { createAbstraction, Result } from "#shared/index.js";
import type { LicenseQueryService } from "#api/services/License/index.js";

export interface IGetLicenseViolationsSummaryUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetLicenseViolationsSummaryUseCase {
    execute(
        params: LicenseQueryService.ViolationsSummaryFilters
    ): Promise<
        Result<LicenseQueryService.ViolationsSummary, IGetLicenseViolationsSummaryUseCaseError>
    >;
}

export const GetLicenseViolationsSummaryUseCase =
    createAbstraction<IGetLicenseViolationsSummaryUseCase>(
        "Api/GetLicenseViolationsSummaryUseCase"
    );

export namespace GetLicenseViolationsSummaryUseCase {
    export type Interface = IGetLicenseViolationsSummaryUseCase;
    export type Params = LicenseQueryService.ViolationsSummaryFilters;
    export type Data = LicenseQueryService.ViolationsSummary;
    export type Error = IGetLicenseViolationsSummaryUseCaseError;
}
