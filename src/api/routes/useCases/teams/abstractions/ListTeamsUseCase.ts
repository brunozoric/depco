import { createAbstraction, Result } from "#shared/index.js";
import type { ITeamWithStats } from "../teamStatsHelper.js";

export interface IListTeamsUseCaseParams {
    page?: number | undefined;
    pageSize?: number | undefined;
}

export interface IListTeamsUseCaseData {
    items: ITeamWithStats[];
    total: number;
}

export interface IListTeamsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListTeamsUseCase {
    execute(
        params: IListTeamsUseCaseParams
    ): Promise<Result<IListTeamsUseCaseData, IListTeamsUseCaseError>>;
}

export const ListTeamsUseCase = createAbstraction<IListTeamsUseCase>("Api/ListTeamsUseCase");

export namespace ListTeamsUseCase {
    export type Interface = IListTeamsUseCase;
    export type Params = IListTeamsUseCaseParams;
    export type Data = IListTeamsUseCaseData;
    export type Error = IListTeamsUseCaseError;
}
