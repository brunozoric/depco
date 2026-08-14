import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardHealthUseCaseParams {
    teamId?: string | undefined;
}

export interface IDashboardHealthProject {
    projectId: string;
    projectName: string;
    score: number;
    scoreDelta: number | null;
    totalPackages: number;
    upToDate: number;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    lastScannedAt: number | null;
    vulnerabilityCritical: number;
    vulnerabilityHigh: number;
    vulnerabilityModerate: number;
    vulnerabilityLow: number;
}

export interface IDashboardWorstProject {
    id: string;
    name: string;
    score: number;
    totalPackages: number;
    upToDate: number;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
}

export interface IDashboardHealthSummary {
    totalProjects: number;
    averageScore: number;
    worstProject: IDashboardWorstProject | null;
}

export interface IGetDashboardHealthUseCaseData {
    summary: IDashboardHealthSummary;
    projects: IDashboardHealthProject[];
}

export interface IGetDashboardHealthUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetDashboardHealthUseCase {
    execute(
        params: IGetDashboardHealthUseCaseParams
    ): Promise<Result<IGetDashboardHealthUseCaseData, IGetDashboardHealthUseCaseError>>;
}

export const GetDashboardHealthUseCase = createAbstraction<IGetDashboardHealthUseCase>(
    "Api/GetDashboardHealthUseCase"
);

export namespace GetDashboardHealthUseCase {
    export type Interface = IGetDashboardHealthUseCase;
    export type Params = IGetDashboardHealthUseCaseParams;
    export type Data = IGetDashboardHealthUseCaseData;
    export type Error = IGetDashboardHealthUseCaseError;
    export type Project = IDashboardHealthProject;
    export type WorstProject = IDashboardWorstProject;
    export type Summary = IDashboardHealthSummary;
}
