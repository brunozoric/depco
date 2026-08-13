import { createAbstraction, Result } from "#shared/index.js";

export interface ISetProjectTeamsUseCaseParams {
    id: string;
    teamIds: string[];
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ISetProjectTeamsUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type SetProjectTeamsUseCaseError =
    ISetProjectTeamsUseCaseErrors[keyof ISetProjectTeamsUseCaseErrors];

export interface ISetProjectTeamsUseCase {
    execute(
        params: ISetProjectTeamsUseCaseParams
    ): Promise<Result<void, SetProjectTeamsUseCaseError>>;
}

export const SetProjectTeamsUseCase = createAbstraction<ISetProjectTeamsUseCase>(
    "Api/SetProjectTeamsUseCase"
);

export namespace SetProjectTeamsUseCase {
    export type Interface = ISetProjectTeamsUseCase;
    export type Params = ISetProjectTeamsUseCaseParams;
    export type Error = SetProjectTeamsUseCaseError;
}
