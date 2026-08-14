import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";
import type { PackageQueryService } from "#api/services/Package/index.js";

export interface IGetPackageDetailUseCaseParams {
    packageName: string;
}

export type IGetPackageDetailUseCaseData = PackageQueryService.Detail;

export interface IPackageNotFoundError {
    code: "PACKAGE_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IGetPackageDetailUseCaseErrors {
    packageNotFound: IPackageNotFoundError;
    unexpected: IUnexpectedError;
}

type GetPackageDetailUseCaseError =
    IGetPackageDetailUseCaseErrors[keyof IGetPackageDetailUseCaseErrors];

export interface IGetPackageDetailUseCase {
    execute(
        params: IGetPackageDetailUseCaseParams
    ): Promise<Result<IGetPackageDetailUseCaseData, GetPackageDetailUseCaseError>>;
}

export const GetPackageDetailUseCase = createAbstraction<IGetPackageDetailUseCase>(
    "Api/GetPackageDetailUseCase"
);

export namespace GetPackageDetailUseCase {
    export type Interface = IGetPackageDetailUseCase;
    export type Params = IGetPackageDetailUseCaseParams;
    export type Data = IGetPackageDetailUseCaseData;
    export type Error = GetPackageDetailUseCaseError;
}
