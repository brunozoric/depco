import { createAbstraction, Result } from "#shared/index.js";

export interface IBulkScanEnginesUseCaseParams {
    projectIds: string[];
}

export interface IBulkScanEnginesUseCaseData {
    scannedCount: number;
}

export interface IBulkScanEnginesUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IBulkScanEnginesUseCase {
    execute(
        params: IBulkScanEnginesUseCaseParams
    ): Promise<Result<IBulkScanEnginesUseCaseData, IBulkScanEnginesUseCaseError>>;
}

export const BulkScanEnginesUseCase = createAbstraction<IBulkScanEnginesUseCase>(
    "Api/BulkScanEnginesUseCase"
);

export namespace BulkScanEnginesUseCase {
    export type Interface = IBulkScanEnginesUseCase;
    export type Params = IBulkScanEnginesUseCaseParams;
    export type Data = IBulkScanEnginesUseCaseData;
    export type Error = IBulkScanEnginesUseCaseError;
}
