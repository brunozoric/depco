import { createAbstraction, Result } from "#shared/index.js";
import type { VulnerabilitySeverityCounts } from "#shared/vulnerabilities/types.js";

export interface IScanVulnerabilitiesUseCaseParams {
    projectId: string;
}

export interface IScanVulnerabilitiesUseCaseData {
    total: number;
    counts: VulnerabilitySeverityCounts;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface INoPackageManagerError {
    statusCode: 422;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IScanVulnerabilitiesUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    noPackageManager: INoPackageManagerError;
    unexpected: IUnexpectedError;
}

type ScanVulnerabilitiesUseCaseError =
    IScanVulnerabilitiesUseCaseErrors[keyof IScanVulnerabilitiesUseCaseErrors];

export interface IScanVulnerabilitiesUseCase {
    execute(
        params: IScanVulnerabilitiesUseCaseParams
    ): Promise<Result<IScanVulnerabilitiesUseCaseData, ScanVulnerabilitiesUseCaseError>>;
}

export const ScanVulnerabilitiesUseCase = createAbstraction<IScanVulnerabilitiesUseCase>(
    "Api/ScanVulnerabilitiesUseCase"
);

export namespace ScanVulnerabilitiesUseCase {
    export type Interface = IScanVulnerabilitiesUseCase;
    export type Params = IScanVulnerabilitiesUseCaseParams;
    export type Data = IScanVulnerabilitiesUseCaseData;
    export type Error = ScanVulnerabilitiesUseCaseError;
}
