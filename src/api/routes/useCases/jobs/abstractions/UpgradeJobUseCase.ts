import { createAbstraction, Result } from "#shared/index.js";

export interface IUpgradeJobUseCasePackageInput {
    name: string;
    targetVersion: string;
}

export interface IUpgradeJobUseCaseParams {
    projectId: string;
    packages: IUpgradeJobUseCasePackageInput[];
    refreshTransient?: boolean | undefined;
}

export interface IUpgradeJobUseCaseData {
    jobId: string;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IEnqueueFailedError {
    code: "ENQUEUE_FAILED";
    statusCode: 403;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IUpgradeJobUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    enqueueFailed: IEnqueueFailedError;
    unexpected: IUnexpectedError;
}

type UpgradeJobUseCaseError = IUpgradeJobUseCaseErrors[keyof IUpgradeJobUseCaseErrors];

export interface IUpgradeJobUseCase {
    execute(
        params: IUpgradeJobUseCaseParams
    ): Promise<Result<IUpgradeJobUseCaseData, UpgradeJobUseCaseError>>;
}

export const UpgradeJobUseCase = createAbstraction<IUpgradeJobUseCase>("Api/UpgradeJobUseCase");

export namespace UpgradeJobUseCase {
    export type Interface = IUpgradeJobUseCase;
    export type PackageInput = IUpgradeJobUseCasePackageInput;
    export type Params = IUpgradeJobUseCaseParams;
    export type Data = IUpgradeJobUseCaseData;
    export type Error = UpgradeJobUseCaseError;
}
