import { createAbstraction, Result } from "#shared/index.js";

export interface IRefreshDependencyGraphUseCaseParams {
    projectId: string;
}

export interface IRefreshDependencyGraphUseCaseData {
    edgeCount: number;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface INoPackageManagerError {
    statusCode: 400;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IRefreshDependencyGraphUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    noPackageManager: INoPackageManagerError;
    unexpected: IUnexpectedError;
}

type RefreshDependencyGraphUseCaseError =
    IRefreshDependencyGraphUseCaseErrors[keyof IRefreshDependencyGraphUseCaseErrors];

export interface IRefreshDependencyGraphUseCase {
    execute(
        params: IRefreshDependencyGraphUseCaseParams
    ): Promise<Result<IRefreshDependencyGraphUseCaseData, RefreshDependencyGraphUseCaseError>>;
}

export const RefreshDependencyGraphUseCase = createAbstraction<IRefreshDependencyGraphUseCase>(
    "Api/RefreshDependencyGraphUseCase"
);

export namespace RefreshDependencyGraphUseCase {
    export type Interface = IRefreshDependencyGraphUseCase;
    export type Params = IRefreshDependencyGraphUseCaseParams;
    export type Data = IRefreshDependencyGraphUseCaseData;
    export type Error = RefreshDependencyGraphUseCaseError;
}
