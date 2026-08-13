import { createAbstraction, Result } from "#shared/index.js";
import type { IEngineScanStaleReason } from "../engineStaleness.js";

export interface IGetProjectEngineStalenessUseCaseParams {
    projectId: string;
}

export interface IGetProjectEngineStalenessUseCaseData {
    lastScannedAt: number | null;
    engineScanStale: boolean;
    engineScanStaleReason: IEngineScanStaleReason | null;
    stalenessThresholdMs: number;
}

export interface IGetProjectEngineStalenessUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetProjectEngineStalenessUseCase {
    execute(
        params: IGetProjectEngineStalenessUseCaseParams
    ): Promise<
        Result<IGetProjectEngineStalenessUseCaseData, IGetProjectEngineStalenessUseCaseError>
    >;
}

export const GetProjectEngineStalenessUseCase =
    createAbstraction<IGetProjectEngineStalenessUseCase>("Api/GetProjectEngineStalenessUseCase");

export namespace GetProjectEngineStalenessUseCase {
    export type Interface = IGetProjectEngineStalenessUseCase;
    export type Params = IGetProjectEngineStalenessUseCaseParams;
    export type Data = IGetProjectEngineStalenessUseCaseData;
    export type Error = IGetProjectEngineStalenessUseCaseError;
}
