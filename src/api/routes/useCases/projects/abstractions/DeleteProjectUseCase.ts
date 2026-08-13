import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteProjectUseCaseParams {
    id: string;
}

export interface IProjectHasRunningJobsError {
    statusCode: 409;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IDeleteProjectUseCaseErrors {
    projectHasRunningJobs: IProjectHasRunningJobsError;
    unexpected: IUnexpectedError;
}

type DeleteProjectUseCaseError = IDeleteProjectUseCaseErrors[keyof IDeleteProjectUseCaseErrors];

export interface IDeleteProjectUseCase {
    execute(params: IDeleteProjectUseCaseParams): Promise<Result<void, DeleteProjectUseCaseError>>;
}

export const DeleteProjectUseCase = createAbstraction<IDeleteProjectUseCase>(
    "Api/DeleteProjectUseCase"
);

export namespace DeleteProjectUseCase {
    export type Interface = IDeleteProjectUseCase;
    export type Params = IDeleteProjectUseCaseParams;
    export type Error = DeleteProjectUseCaseError;
}
