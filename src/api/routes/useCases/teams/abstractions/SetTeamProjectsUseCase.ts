import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";

export interface ISetTeamProjectsUseCaseParams {
    id: string;
    projectIds: string[];
}

export interface ITeamNotFoundError {
    code: "TEAM_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface ISetTeamProjectsUseCaseErrors {
    notFound: ITeamNotFoundError;
    unexpected: IUnexpectedError;
}

type SetTeamProjectsUseCaseError =
    ISetTeamProjectsUseCaseErrors[keyof ISetTeamProjectsUseCaseErrors];

export interface ISetTeamProjectsUseCase {
    execute(
        params: ISetTeamProjectsUseCaseParams
    ): Promise<Result<void, SetTeamProjectsUseCaseError>>;
}

export const SetTeamProjectsUseCase = createAbstraction<ISetTeamProjectsUseCase>(
    "Api/SetTeamProjectsUseCase"
);

export namespace SetTeamProjectsUseCase {
    export type Interface = ISetTeamProjectsUseCase;
    export type Params = ISetTeamProjectsUseCaseParams;
    export type Error = SetTeamProjectsUseCaseError;
}
