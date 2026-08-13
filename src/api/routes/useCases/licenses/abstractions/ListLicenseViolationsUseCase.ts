import { createAbstraction, Result } from "#shared/index.js";
import type { LicenseQueryService } from "#api/services/License/index.js";

export interface IListLicenseViolationsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListLicenseViolationsUseCase {
    execute(
        params: LicenseQueryService.ViolationListFilters
    ): Promise<Result<LicenseQueryService.ViolationListResult, IListLicenseViolationsUseCaseError>>;
}

export const ListLicenseViolationsUseCase = createAbstraction<IListLicenseViolationsUseCase>(
    "Api/ListLicenseViolationsUseCase"
);

export namespace ListLicenseViolationsUseCase {
    export type Interface = IListLicenseViolationsUseCase;
    export type Params = LicenseQueryService.ViolationListFilters;
    export type Data = LicenseQueryService.ViolationListResult;
    export type Error = IListLicenseViolationsUseCaseError;
}
