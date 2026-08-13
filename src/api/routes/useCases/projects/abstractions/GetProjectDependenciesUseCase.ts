import { createAbstraction, Result } from "#shared/index.js";

export type ProjectDependencyKindFilter =
    | "all"
    | "dependency"
    | "devDependency"
    | "peerDependency"
    | "optionalDependency"
    | "transitive";

export type ProjectDependencyRegistryResolvedFilter = "all" | "true" | "false";

export interface IGetProjectDependenciesUseCaseParams {
    id: string;
    dependencyKind?: ProjectDependencyKindFilter | undefined;
    registryResolved?: ProjectDependencyRegistryResolvedFilter | undefined;
    search?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}

export interface IProjectDependencyItem {
    name: string;
    currentVersion: string;
    latestVersion: string | null;
    latestInRange: string | null;
    type: string;
    upgradeType: string | null;
    dependencyKind: string;
    registryResolved: boolean;
}

export interface IGetProjectDependenciesUseCaseData {
    items: IProjectDependencyItem[];
    total: number;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetProjectDependenciesUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GetProjectDependenciesUseCaseError =
    IGetProjectDependenciesUseCaseErrors[keyof IGetProjectDependenciesUseCaseErrors];

export interface IGetProjectDependenciesUseCase {
    execute(
        params: IGetProjectDependenciesUseCaseParams
    ): Promise<Result<IGetProjectDependenciesUseCaseData, GetProjectDependenciesUseCaseError>>;
}

export const GetProjectDependenciesUseCase = createAbstraction<IGetProjectDependenciesUseCase>(
    "Api/GetProjectDependenciesUseCase"
);

export namespace GetProjectDependenciesUseCase {
    export type Interface = IGetProjectDependenciesUseCase;
    export type Params = IGetProjectDependenciesUseCaseParams;
    export type DependencyItem = IProjectDependencyItem;
    export type Data = IGetProjectDependenciesUseCaseData;
    export type Error = GetProjectDependenciesUseCaseError;
}
