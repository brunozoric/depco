import { createAbstraction, Result } from "#shared/index.js";
import type { ITeamWithStats } from "../teamStatsHelper.js";

export interface ICreateTeamUseCaseParams {
    name: string;
    color: string;
}

export type ICreateTeamUseCaseData = ITeamWithStats;

export interface INameConflictError {
    statusCode: 409;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ICreateTeamUseCaseErrors {
    nameConflict: INameConflictError;
    unexpected: IUnexpectedError;
}

type CreateTeamUseCaseError = ICreateTeamUseCaseErrors[keyof ICreateTeamUseCaseErrors];

export interface ICreateTeamUseCase {
    execute(
        params: ICreateTeamUseCaseParams
    ): Promise<Result<ICreateTeamUseCaseData, CreateTeamUseCaseError>>;
}

export const CreateTeamUseCase = createAbstraction<ICreateTeamUseCase>("Api/CreateTeamUseCase");

export namespace CreateTeamUseCase {
    export type Interface = ICreateTeamUseCase;
    export type Params = ICreateTeamUseCaseParams;
    export type Data = ICreateTeamUseCaseData;
    export type Error = CreateTeamUseCaseError;
}
