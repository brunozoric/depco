import { createAbstraction } from "#shared/index.js";

export interface ILoadDashboardParams {
    trendRange: string;
    teamId?: string;
}

export interface ILoadDashboardUseCase {
    execute(params: ILoadDashboardParams): Promise<void>;
    refreshHealth(teamId?: string): Promise<void>;
    refreshActivity(): Promise<void>;
}

export const LoadDashboardUseCase =
    createAbstraction<ILoadDashboardUseCase>("Ui/LoadDashboardUseCase");

export namespace LoadDashboardUseCase {
    export type Interface = ILoadDashboardUseCase;
    export type Params = ILoadDashboardParams;
}
