import { createAbstraction, Result } from "#shared/index.js";

export interface IGetPackageManagerUseCaseParams {
    id: string;
}

export interface IGetPackageManagerUseCaseData {
    version: string;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetPackageManagerUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GetPackageManagerUseCaseError =
    IGetPackageManagerUseCaseErrors[keyof IGetPackageManagerUseCaseErrors];

export interface IGetPackageManagerUseCase {
    execute(
        params: IGetPackageManagerUseCaseParams
    ): Promise<Result<IGetPackageManagerUseCaseData, GetPackageManagerUseCaseError>>;
}

export const GetPackageManagerUseCase = createAbstraction<IGetPackageManagerUseCase>(
    "Api/GetPackageManagerUseCase"
);

export namespace GetPackageManagerUseCase {
    export type Interface = IGetPackageManagerUseCase;
    export type Params = IGetPackageManagerUseCaseParams;
    export type Data = IGetPackageManagerUseCaseData;
    export type Error = GetPackageManagerUseCaseError;
}
