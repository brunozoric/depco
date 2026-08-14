import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError,
    type INameAlreadyExistsError
} from "#shared/index.js";

export interface IUpdateProjectUseCaseParams {
    id: string;
    name: string;
}

export interface IUpdateProjectUseCaseData {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    hasNodeModules: boolean;
    engineStatus: string | null;
    rootEnginesNode: string | null;
}

export interface IUpdateProjectUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    nameAlreadyExists: INameAlreadyExistsError;
    unexpected: IUnexpectedError;
}

type UpdateProjectUseCaseError = IUpdateProjectUseCaseErrors[keyof IUpdateProjectUseCaseErrors];

export interface IUpdateProjectUseCase {
    execute(
        params: IUpdateProjectUseCaseParams
    ): Promise<Result<IUpdateProjectUseCaseData, UpdateProjectUseCaseError>>;
}

export const UpdateProjectUseCase = createAbstraction<IUpdateProjectUseCase>(
    "Api/UpdateProjectUseCase"
);

export namespace UpdateProjectUseCase {
    export type Interface = IUpdateProjectUseCase;
    export type Params = IUpdateProjectUseCaseParams;
    export type Data = IUpdateProjectUseCaseData;
    export type Error = UpdateProjectUseCaseError;
}
