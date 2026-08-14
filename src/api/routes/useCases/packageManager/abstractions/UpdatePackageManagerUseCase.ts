import { createAbstraction, Result } from "#shared/index.js";

export interface IUpdatePackageManagerUseCaseParams {
    id: string;
    version: string;
}

export interface IUpdatePackageManagerUseCaseData {
    jobId: string;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IEnqueueForbiddenError {
    code: "ENQUEUE_FORBIDDEN";
    statusCode: 403;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IUpdatePackageManagerUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    enqueueForbidden: IEnqueueForbiddenError;
    unexpected: IUnexpectedError;
}

type UpdatePackageManagerUseCaseError =
    IUpdatePackageManagerUseCaseErrors[keyof IUpdatePackageManagerUseCaseErrors];

export interface IUpdatePackageManagerUseCase {
    execute(
        params: IUpdatePackageManagerUseCaseParams
    ): Promise<Result<IUpdatePackageManagerUseCaseData, UpdatePackageManagerUseCaseError>>;
}

export const UpdatePackageManagerUseCase = createAbstraction<IUpdatePackageManagerUseCase>(
    "Api/UpdatePackageManagerUseCase"
);

export namespace UpdatePackageManagerUseCase {
    export type Interface = IUpdatePackageManagerUseCase;
    export type Params = IUpdatePackageManagerUseCaseParams;
    export type Data = IUpdatePackageManagerUseCaseData;
    export type Error = UpdatePackageManagerUseCaseError;
}
