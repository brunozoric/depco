import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface IInstallProjectUseCaseParams {
    id: string;
    flags: string[];
}

export interface IInstallProjectUseCaseData {
    jobId: string;
}

export interface INoPackageManagerError {
    code: "NO_PACKAGE_MANAGER";
    statusCode: 400;
    message: string;
}

export interface IInstallProjectUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    noPackageManager: INoPackageManagerError;
    unexpected: IUnexpectedError;
}

type InstallProjectUseCaseError = IInstallProjectUseCaseErrors[keyof IInstallProjectUseCaseErrors];

export interface IInstallProjectUseCase {
    execute(
        params: IInstallProjectUseCaseParams
    ): Promise<Result<IInstallProjectUseCaseData, InstallProjectUseCaseError>>;
}

export const InstallProjectUseCase = createAbstraction<IInstallProjectUseCase>(
    "Api/InstallProjectUseCase"
);

export namespace InstallProjectUseCase {
    export type Interface = IInstallProjectUseCase;
    export type Params = IInstallProjectUseCaseParams;
    export type Data = IInstallProjectUseCaseData;
    export type Error = InstallProjectUseCaseError;
}
