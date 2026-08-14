import { createAbstraction, Result } from "#shared/index.js";

export interface IBulkRescanVulnerabilitiesUseCaseParams {
    ids: string[];
}

export interface IBulkRescanVulnerabilitiesUseCaseData {
    projectsQueued: number;
}

export interface IBulkRescanVulnerabilitiesUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IBulkRescanVulnerabilitiesUseCase {
    execute(
        params: IBulkRescanVulnerabilitiesUseCaseParams
    ): Promise<
        Result<IBulkRescanVulnerabilitiesUseCaseData, IBulkRescanVulnerabilitiesUseCaseError>
    >;
}

export const BulkRescanVulnerabilitiesUseCase =
    createAbstraction<IBulkRescanVulnerabilitiesUseCase>("Api/BulkRescanVulnerabilitiesUseCase");

export namespace BulkRescanVulnerabilitiesUseCase {
    export type Interface = IBulkRescanVulnerabilitiesUseCase;
    export type Params = IBulkRescanVulnerabilitiesUseCaseParams;
    export type Data = IBulkRescanVulnerabilitiesUseCaseData;
    export type Error = IBulkRescanVulnerabilitiesUseCaseError;
}
