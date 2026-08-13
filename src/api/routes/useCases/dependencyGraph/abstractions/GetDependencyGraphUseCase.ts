import { createAbstraction, Result } from "#shared/index.js";
import type { DependencyGraphService } from "#api/services/DependencyGraph/index.js";

export interface IGetDependencyGraphUseCaseParams {
    projectId: string;
    packageName?: string | undefined;
}

export interface IGetDependencyGraphPathsResult {
    paths: DependencyGraphService.Path[];
}

export type IGetDependencyGraphUseCaseData =
    | DependencyGraphService.Graph
    | IGetDependencyGraphPathsResult;

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetDependencyGraphUseCaseErrors {
    unexpected: IUnexpectedError;
}

type GetDependencyGraphUseCaseError =
    IGetDependencyGraphUseCaseErrors[keyof IGetDependencyGraphUseCaseErrors];

export interface IGetDependencyGraphUseCase {
    execute(
        params: IGetDependencyGraphUseCaseParams
    ): Promise<Result<IGetDependencyGraphUseCaseData, GetDependencyGraphUseCaseError>>;
}

export const GetDependencyGraphUseCase = createAbstraction<IGetDependencyGraphUseCase>(
    "Api/GetDependencyGraphUseCase"
);

export namespace GetDependencyGraphUseCase {
    export type Interface = IGetDependencyGraphUseCase;
    export type Params = IGetDependencyGraphUseCaseParams;
    export type Data = IGetDependencyGraphUseCaseData;
    export type Error = GetDependencyGraphUseCaseError;
}
