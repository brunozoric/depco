import { createAbstraction, Result } from "#shared/index.js";

export interface IBulkScanProjectsUseCaseParams {
    projectIds: string[];
    force?: boolean | undefined;
}

export interface IBulkScanProjectsUseCaseData {
    enqueuedCount: number;
    skippedCount: number;
}

export interface IBulkScanProjectsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IBulkScanProjectsUseCase {
    execute(
        params: IBulkScanProjectsUseCaseParams
    ): Promise<Result<IBulkScanProjectsUseCaseData, IBulkScanProjectsUseCaseError>>;
}

export const BulkScanProjectsUseCase = createAbstraction<IBulkScanProjectsUseCase>(
    "Api/BulkScanProjectsUseCase"
);

export namespace BulkScanProjectsUseCase {
    export type Interface = IBulkScanProjectsUseCase;
    export type Params = IBulkScanProjectsUseCaseParams;
    export type Data = IBulkScanProjectsUseCaseData;
    export type Error = IBulkScanProjectsUseCaseError;
}
