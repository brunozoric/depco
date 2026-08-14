import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface IRefreshDependencyGraphUseCaseParams {
    projectId: string;
}

export interface IRefreshDependencyGraphUseCaseData {
    edgeCount: number;
}

export interface INoPackageManagerError {
    code: "NO_PACKAGE_MANAGER";
    statusCode: 400;
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
