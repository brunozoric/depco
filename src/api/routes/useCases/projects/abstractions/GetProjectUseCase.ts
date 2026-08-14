import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface IGetProjectUseCaseParams {
    id: string;
}

export interface IGetProjectUseCaseData {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    hasNodeModules: boolean;
}

export interface IGetProjectUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GetProjectUseCaseError = IGetProjectUseCaseErrors[keyof IGetProjectUseCaseErrors];

export interface IGetProjectUseCase {
    execute(
        params: IGetProjectUseCaseParams
    ): Promise<Result<IGetProjectUseCaseData, GetProjectUseCaseError>>;
}

export const GetProjectUseCase = createAbstraction<IGetProjectUseCase>("Api/GetProjectUseCase");

export namespace GetProjectUseCase {
    export type Interface = IGetProjectUseCase;
    export type Params = IGetProjectUseCaseParams;
    export type Data = IGetProjectUseCaseData;
    export type Error = GetProjectUseCaseError;
}
