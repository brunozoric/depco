import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";

export interface IGetTeamUseCaseParams {
    id: string;
}

export interface IGetTeamUseCaseProject {
    id: string;
    name: string;
    path: string;
}

export interface IGetTeamUseCaseData {
    id: string;
    name: string;
    color: string;
    createdAt: number;
    projects: IGetTeamUseCaseProject[];
}

export interface ITeamNotFoundError {
    code: "TEAM_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IGetTeamUseCaseErrors {
    notFound: ITeamNotFoundError;
    unexpected: IUnexpectedError;
}

type GetTeamUseCaseError = IGetTeamUseCaseErrors[keyof IGetTeamUseCaseErrors];

export interface IGetTeamUseCase {
    execute(
        params: IGetTeamUseCaseParams
    ): Promise<Result<IGetTeamUseCaseData, GetTeamUseCaseError>>;
}

export const GetTeamUseCase = createAbstraction<IGetTeamUseCase>("Api/GetTeamUseCase");

export namespace GetTeamUseCase {
    export type Interface = IGetTeamUseCase;
    export type Params = IGetTeamUseCaseParams;
    export type Data = IGetTeamUseCaseData;
    export type Error = GetTeamUseCaseError;
}
