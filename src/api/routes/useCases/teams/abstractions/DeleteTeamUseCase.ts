import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteTeamUseCaseParams {
    id: string;
}

export interface ITeamNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IDeleteTeamUseCaseErrors {
    notFound: ITeamNotFoundError;
    unexpected: IUnexpectedError;
}

type DeleteTeamUseCaseError = IDeleteTeamUseCaseErrors[keyof IDeleteTeamUseCaseErrors];

export interface IDeleteTeamUseCase {
    execute(params: IDeleteTeamUseCaseParams): Promise<Result<void, DeleteTeamUseCaseError>>;
}

export const DeleteTeamUseCase = createAbstraction<IDeleteTeamUseCase>("Api/DeleteTeamUseCase");

export namespace DeleteTeamUseCase {
    export type Interface = IDeleteTeamUseCase;
    export type Params = IDeleteTeamUseCaseParams;
    export type Error = DeleteTeamUseCaseError;
}
