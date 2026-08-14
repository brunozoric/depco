import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";
import type { ITeamWithStats } from "../teamStatsHelper.js";

export interface IUpdateTeamUseCaseParams {
    id: string;
    name?: string | undefined;
    color?: string | undefined;
}

export type IUpdateTeamUseCaseData = ITeamWithStats;

export interface ITeamNotFoundError {
    code: "TEAM_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface INameConflictError {
    code: "TEAM_NAME_CONFLICT";
    statusCode: 409;
    message: string;
}

export interface IUpdateTeamUseCaseErrors {
    notFound: ITeamNotFoundError;
    nameConflict: INameConflictError;
    unexpected: IUnexpectedError;
}

type UpdateTeamUseCaseError = IUpdateTeamUseCaseErrors[keyof IUpdateTeamUseCaseErrors];

export interface IUpdateTeamUseCase {
    execute(
        params: IUpdateTeamUseCaseParams
    ): Promise<Result<IUpdateTeamUseCaseData, UpdateTeamUseCaseError>>;
}

export const UpdateTeamUseCase = createAbstraction<IUpdateTeamUseCase>("Api/UpdateTeamUseCase");

export namespace UpdateTeamUseCase {
    export type Interface = IUpdateTeamUseCase;
    export type Params = IUpdateTeamUseCaseParams;
    export type Data = IUpdateTeamUseCaseData;
    export type Error = UpdateTeamUseCaseError;
}
