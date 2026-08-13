import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardActivityUseCaseParams {
    teamId?: string | undefined;
}

export interface IDashboardActivityJob {
    id: string;
    type: string;
    referenceId: string;
    referenceType: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
}

export interface IGetDashboardActivityUseCaseData {
    items: IDashboardActivityJob[];
}

export interface IGetDashboardActivityUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardActivityUseCase {
    execute(
        params: IGetDashboardActivityUseCaseParams
    ): Promise<Result<IGetDashboardActivityUseCaseData, IGetDashboardActivityUseCaseError>>;
}

export const GetDashboardActivityUseCase = createAbstraction<IGetDashboardActivityUseCase>(
    "Api/GetDashboardActivityUseCase"
);

export namespace GetDashboardActivityUseCase {
    export type Interface = IGetDashboardActivityUseCase;
    export type Params = IGetDashboardActivityUseCaseParams;
    export type Data = IGetDashboardActivityUseCaseData;
    export type Error = IGetDashboardActivityUseCaseError;
    export type Job = IDashboardActivityJob;
}
