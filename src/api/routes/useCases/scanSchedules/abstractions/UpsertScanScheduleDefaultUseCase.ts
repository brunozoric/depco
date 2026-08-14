import { createAbstraction, Result } from "#shared/index.js";
import type { ScanInterval } from "#shared/schedules/types.js";

export interface IUpsertScanScheduleDefaultUseCaseParams {
    interval: ScanInterval;
}

export interface IUpsertScanScheduleDefaultUseCaseData {
    interval: string;
}

export interface IUpsertScanScheduleDefaultUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IUpsertScanScheduleDefaultUseCase {
    execute(
        params: IUpsertScanScheduleDefaultUseCaseParams
    ): Promise<
        Result<IUpsertScanScheduleDefaultUseCaseData, IUpsertScanScheduleDefaultUseCaseError>
    >;
}

export const UpsertScanScheduleDefaultUseCase =
    createAbstraction<IUpsertScanScheduleDefaultUseCase>("Api/UpsertScanScheduleDefaultUseCase");

export namespace UpsertScanScheduleDefaultUseCase {
    export type Interface = IUpsertScanScheduleDefaultUseCase;
    export type Params = IUpsertScanScheduleDefaultUseCaseParams;
    export type Data = IUpsertScanScheduleDefaultUseCaseData;
    export type Error = IUpsertScanScheduleDefaultUseCaseError;
}
