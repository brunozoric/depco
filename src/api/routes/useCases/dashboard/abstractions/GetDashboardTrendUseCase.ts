import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardTrendUseCaseParams {
    range?: string | undefined;
    teamId?: string | undefined;
}

export interface IDashboardTrendSnapshot {
    date: string;
    score: number;
}

export interface IDashboardTrendGroupItem {
    projectId: string;
    projectName: string;
    snapshots: IDashboardTrendSnapshot[];
}

export interface IGetDashboardTrendUseCaseData {
    items: IDashboardTrendGroupItem[];
}

export interface IGetDashboardTrendUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardTrendUseCase {
    execute(
        params: IGetDashboardTrendUseCaseParams
    ): Promise<Result<IGetDashboardTrendUseCaseData, IGetDashboardTrendUseCaseError>>;
}

export const GetDashboardTrendUseCase = createAbstraction<IGetDashboardTrendUseCase>(
    "Api/GetDashboardTrendUseCase"
);

export namespace GetDashboardTrendUseCase {
    export type Interface = IGetDashboardTrendUseCase;
    export type Params = IGetDashboardTrendUseCaseParams;
    export type Data = IGetDashboardTrendUseCaseData;
    export type Error = IGetDashboardTrendUseCaseError;
    export type Snapshot = IDashboardTrendSnapshot;
    export type GroupItem = IDashboardTrendGroupItem;
}
