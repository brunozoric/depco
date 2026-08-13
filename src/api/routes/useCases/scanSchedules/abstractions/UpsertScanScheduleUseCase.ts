import { createAbstraction, Result } from "#shared/index.js";
import type { ScanInterval } from "#shared/schedules/types.js";
import type { IScanScheduleResponse } from "../scanScheduleHelper.js";

export interface IUpsertScanScheduleUseCaseParams {
    projectId: string;
    interval: ScanInterval;
}

export type IUpsertScanScheduleUseCaseData = IScanScheduleResponse;

export interface IUpsertScanScheduleUseCaseError {
    statusCode: number;
    message: string;
}

export interface IUpsertScanScheduleUseCase {
    execute(
        params: IUpsertScanScheduleUseCaseParams
    ): Promise<Result<IUpsertScanScheduleUseCaseData, IUpsertScanScheduleUseCaseError>>;
}

export const UpsertScanScheduleUseCase = createAbstraction<IUpsertScanScheduleUseCase>(
    "Api/UpsertScanScheduleUseCase"
);

export namespace UpsertScanScheduleUseCase {
    export type Interface = IUpsertScanScheduleUseCase;
    export type Params = IUpsertScanScheduleUseCaseParams;
    export type Data = IUpsertScanScheduleUseCaseData;
    export type Error = IUpsertScanScheduleUseCaseError;
}
