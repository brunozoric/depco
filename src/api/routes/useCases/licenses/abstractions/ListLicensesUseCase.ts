import { createAbstraction, Result } from "#shared/index.js";
import type { LicenseQueryService } from "#api/services/License/index.js";

export interface IListLicensesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListLicensesUseCase {
    execute(
        params: LicenseQueryService.ListFilters
    ): Promise<Result<LicenseQueryService.ListResult, IListLicensesUseCaseError>>;
}

export const ListLicensesUseCase =
    createAbstraction<IListLicensesUseCase>("Api/ListLicensesUseCase");

export namespace ListLicensesUseCase {
    export type Interface = IListLicensesUseCase;
    export type Params = LicenseQueryService.ListFilters;
    export type Data = LicenseQueryService.ListResult;
    export type Error = IListLicensesUseCaseError;
}
