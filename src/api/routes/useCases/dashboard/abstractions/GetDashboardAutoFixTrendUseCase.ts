import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardAutoFixTrendUseCaseParams {
    days?: string | undefined;
    teamId?: string | undefined;
}

export interface IDashboardAutoFixTrendPoint {
    date: string;
    pending: number;
    created: number;
    merged: number;
    closed: number;
    failed: number;
}

export interface IGetDashboardAutoFixTrendUseCaseData {
    points: IDashboardAutoFixTrendPoint[];
}

export interface IGetDashboardAutoFixTrendUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetDashboardAutoFixTrendUseCase {
    execute(
        params: IGetDashboardAutoFixTrendUseCaseParams
    ): Promise<Result<IGetDashboardAutoFixTrendUseCaseData, IGetDashboardAutoFixTrendUseCaseError>>;
}

export const GetDashboardAutoFixTrendUseCase = createAbstraction<IGetDashboardAutoFixTrendUseCase>(
    "Api/GetDashboardAutoFixTrendUseCase"
);

export namespace GetDashboardAutoFixTrendUseCase {
    export type Interface = IGetDashboardAutoFixTrendUseCase;
    export type Params = IGetDashboardAutoFixTrendUseCaseParams;
    export type Data = IGetDashboardAutoFixTrendUseCaseData;
    export type Error = IGetDashboardAutoFixTrendUseCaseError;
    export type Point = IDashboardAutoFixTrendPoint;
}
