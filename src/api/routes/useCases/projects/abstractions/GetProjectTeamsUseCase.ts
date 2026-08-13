import { createAbstraction, Result } from "#shared/index.js";

export interface IGetProjectTeamsUseCaseParams {
    id: string;
}

export interface IProjectTeam {
    id: string;
    name: string;
    color: string;
}

export interface IGetProjectTeamsUseCaseData {
    items: IProjectTeam[];
    total: number;
}

export interface IGetProjectTeamsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetProjectTeamsUseCase {
    execute(
        params: IGetProjectTeamsUseCaseParams
    ): Promise<Result<IGetProjectTeamsUseCaseData, IGetProjectTeamsUseCaseError>>;
}

export const GetProjectTeamsUseCase = createAbstraction<IGetProjectTeamsUseCase>(
    "Api/GetProjectTeamsUseCase"
);

export namespace GetProjectTeamsUseCase {
    export type Interface = IGetProjectTeamsUseCase;
    export type Params = IGetProjectTeamsUseCaseParams;
    export type Team = IProjectTeam;
    export type Data = IGetProjectTeamsUseCaseData;
    export type Error = IGetProjectTeamsUseCaseError;
}
