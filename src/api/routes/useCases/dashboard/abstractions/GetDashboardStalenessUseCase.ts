import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardStalenessUseCaseParams {
    teamId?: string | undefined;
}

export interface IDashboardStalenessProject {
    projectId: string;
    projectName: string;
    lastScannedAt: number | null;
}

export interface IGetDashboardStalenessUseCaseData {
    items: IDashboardStalenessProject[];
}

export interface IGetDashboardStalenessUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardStalenessUseCase {
    execute(
        params: IGetDashboardStalenessUseCaseParams
    ): Promise<Result<IGetDashboardStalenessUseCaseData, IGetDashboardStalenessUseCaseError>>;
}

export const GetDashboardStalenessUseCase = createAbstraction<IGetDashboardStalenessUseCase>(
    "Api/GetDashboardStalenessUseCase"
);

export namespace GetDashboardStalenessUseCase {
    export type Interface = IGetDashboardStalenessUseCase;
    export type Params = IGetDashboardStalenessUseCaseParams;
    export type Data = IGetDashboardStalenessUseCaseData;
    export type Error = IGetDashboardStalenessUseCaseError;
    export type Project = IDashboardStalenessProject;
}
