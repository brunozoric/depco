import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardStalenessTrendUseCaseParams {
    days?: string | undefined;
    teamId?: string | undefined;
}

export interface IDashboardStalenessTrendPoint {
    date: string;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    totalPackages: number;
}

export interface IGetDashboardStalenessTrendUseCaseData {
    points: IDashboardStalenessTrendPoint[];
}

export interface IGetDashboardStalenessTrendUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetDashboardStalenessTrendUseCase {
    execute(
        params: IGetDashboardStalenessTrendUseCaseParams
    ): Promise<
        Result<IGetDashboardStalenessTrendUseCaseData, IGetDashboardStalenessTrendUseCaseError>
    >;
}

export const GetDashboardStalenessTrendUseCase =
    createAbstraction<IGetDashboardStalenessTrendUseCase>("Api/GetDashboardStalenessTrendUseCase");

export namespace GetDashboardStalenessTrendUseCase {
    export type Interface = IGetDashboardStalenessTrendUseCase;
    export type Params = IGetDashboardStalenessTrendUseCaseParams;
    export type Data = IGetDashboardStalenessTrendUseCaseData;
    export type Error = IGetDashboardStalenessTrendUseCaseError;
    export type Point = IDashboardStalenessTrendPoint;
}
