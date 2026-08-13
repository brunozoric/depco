import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardLicenseTrendUseCaseParams {
    days?: string | undefined;
    teamId?: string | undefined;
}

export interface IDashboardLicenseTrendPoint {
    date: string;
    compliantCount: number;
    deniedCount: number;
    warnedCount: number;
    totalPackages: number;
}

export interface IGetDashboardLicenseTrendUseCaseData {
    points: IDashboardLicenseTrendPoint[];
}

export interface IGetDashboardLicenseTrendUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardLicenseTrendUseCase {
    execute(
        params: IGetDashboardLicenseTrendUseCaseParams
    ): Promise<Result<IGetDashboardLicenseTrendUseCaseData, IGetDashboardLicenseTrendUseCaseError>>;
}

export const GetDashboardLicenseTrendUseCase = createAbstraction<IGetDashboardLicenseTrendUseCase>(
    "Api/GetDashboardLicenseTrendUseCase"
);

export namespace GetDashboardLicenseTrendUseCase {
    export type Interface = IGetDashboardLicenseTrendUseCase;
    export type Params = IGetDashboardLicenseTrendUseCaseParams;
    export type Data = IGetDashboardLicenseTrendUseCaseData;
    export type Error = IGetDashboardLicenseTrendUseCaseError;
    export type Point = IDashboardLicenseTrendPoint;
}
