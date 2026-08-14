import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardScoreDetailUseCaseParams {
    projectId: string;
}

export interface IScoreDetailOutdatedPackage {
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: "major" | "minor" | "patch";
}

export interface IScoreDetailVulnerability {
    packageName: string;
    severity: "critical" | "high" | "moderate" | "low";
    title: string;
    fixVersion: string | null;
    penalty: number;
}

export interface IGetDashboardScoreDetailUseCaseData {
    outdatedPackages: IScoreDetailOutdatedPackage[];
    vulnerabilities: IScoreDetailVulnerability[];
}

export interface IGetDashboardScoreDetailUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetDashboardScoreDetailUseCase {
    execute(
        params: IGetDashboardScoreDetailUseCaseParams
    ): Promise<Result<IGetDashboardScoreDetailUseCaseData, IGetDashboardScoreDetailUseCaseError>>;
}

export const GetDashboardScoreDetailUseCase = createAbstraction<IGetDashboardScoreDetailUseCase>(
    "Api/GetDashboardScoreDetailUseCase"
);

export namespace GetDashboardScoreDetailUseCase {
    export type Interface = IGetDashboardScoreDetailUseCase;
    export type Params = IGetDashboardScoreDetailUseCaseParams;
    export type Data = IGetDashboardScoreDetailUseCaseData;
    export type Error = IGetDashboardScoreDetailUseCaseError;
    export type OutdatedPackage = IScoreDetailOutdatedPackage;
    export type Vulnerability = IScoreDetailVulnerability;
}
