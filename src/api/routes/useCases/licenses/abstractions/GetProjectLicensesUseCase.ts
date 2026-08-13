import { createAbstraction, Result } from "#shared/index.js";
import type { LicenseQueryService } from "#api/services/License/index.js";

export interface IGetProjectLicensesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetProjectLicensesUseCase {
    execute(
        params: LicenseQueryService.ProjectListFilters
    ): Promise<Result<LicenseQueryService.ProjectListResult, IGetProjectLicensesUseCaseError>>;
}

export const GetProjectLicensesUseCase = createAbstraction<IGetProjectLicensesUseCase>(
    "Api/GetProjectLicensesUseCase"
);

export namespace GetProjectLicensesUseCase {
    export type Interface = IGetProjectLicensesUseCase;
    export type Params = LicenseQueryService.ProjectListFilters;
    export type Data = LicenseQueryService.ProjectListResult;
    export type Error = IGetProjectLicensesUseCaseError;
}
