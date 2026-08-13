import { createAbstraction, Result } from "#shared/index.js";

export interface ISearchDependencyPackagesUseCaseParams {
    projectId: string;
    query: string;
    limit?: number | undefined;
}

export interface ISearchDependencyPackagesUseCaseData {
    packages: string[];
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ISearchDependencyPackagesUseCaseErrors {
    unexpected: IUnexpectedError;
}

type SearchDependencyPackagesUseCaseError =
    ISearchDependencyPackagesUseCaseErrors[keyof ISearchDependencyPackagesUseCaseErrors];

export interface ISearchDependencyPackagesUseCase {
    execute(
        params: ISearchDependencyPackagesUseCaseParams
    ): Promise<Result<ISearchDependencyPackagesUseCaseData, SearchDependencyPackagesUseCaseError>>;
}

export const SearchDependencyPackagesUseCase = createAbstraction<ISearchDependencyPackagesUseCase>(
    "Api/SearchDependencyPackagesUseCase"
);

export namespace SearchDependencyPackagesUseCase {
    export type Interface = ISearchDependencyPackagesUseCase;
    export type Params = ISearchDependencyPackagesUseCaseParams;
    export type Data = ISearchDependencyPackagesUseCaseData;
    export type Error = SearchDependencyPackagesUseCaseError;
}
