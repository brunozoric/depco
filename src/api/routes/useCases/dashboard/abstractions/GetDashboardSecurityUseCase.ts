import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardSecurityUseCaseParams {
    teamId?: string | undefined;
}

export interface IDashboardSecurityProject {
    projectId: string;
    projectName: string;
    totalChecks: number;
    passingChecks: number;
}

export interface IGetDashboardSecurityUseCaseData {
    items: IDashboardSecurityProject[];
}

export interface IGetDashboardSecurityUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardSecurityUseCase {
    execute(
        params: IGetDashboardSecurityUseCaseParams
    ): Promise<Result<IGetDashboardSecurityUseCaseData, IGetDashboardSecurityUseCaseError>>;
}

export const GetDashboardSecurityUseCase = createAbstraction<IGetDashboardSecurityUseCase>(
    "Api/GetDashboardSecurityUseCase"
);

export namespace GetDashboardSecurityUseCase {
    export type Interface = IGetDashboardSecurityUseCase;
    export type Params = IGetDashboardSecurityUseCaseParams;
    export type Data = IGetDashboardSecurityUseCaseData;
    export type Error = IGetDashboardSecurityUseCaseError;
    export type Project = IDashboardSecurityProject;
}
