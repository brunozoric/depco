import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDependencyGraphStatsUseCaseParams {
    projectId: string;
}

export interface IGetDependencyGraphStatsUseCaseData {
    totalPackages: number;
    maxDepth: number;
    rootCount: number;
    edgeCount: number;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetDependencyGraphStatsUseCaseErrors {
    unexpected: IUnexpectedError;
}

type GetDependencyGraphStatsUseCaseError =
    IGetDependencyGraphStatsUseCaseErrors[keyof IGetDependencyGraphStatsUseCaseErrors];

export interface IGetDependencyGraphStatsUseCase {
    execute(
        params: IGetDependencyGraphStatsUseCaseParams
    ): Promise<Result<IGetDependencyGraphStatsUseCaseData, GetDependencyGraphStatsUseCaseError>>;
}

export const GetDependencyGraphStatsUseCase = createAbstraction<IGetDependencyGraphStatsUseCase>(
    "Api/GetDependencyGraphStatsUseCase"
);

export namespace GetDependencyGraphStatsUseCase {
    export type Interface = IGetDependencyGraphStatsUseCase;
    export type Params = IGetDependencyGraphStatsUseCaseParams;
    export type Data = IGetDependencyGraphStatsUseCaseData;
    export type Error = GetDependencyGraphStatsUseCaseError;
}
