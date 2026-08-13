import { createAbstraction, Result } from "#shared/index.js";

export interface IGetScanScheduleDefaultUseCaseParams {}

export interface IGetScanScheduleDefaultUseCaseData {
    interval: string;
}

export interface IGetScanScheduleDefaultUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetScanScheduleDefaultUseCase {
    execute(
        params: IGetScanScheduleDefaultUseCaseParams
    ): Promise<Result<IGetScanScheduleDefaultUseCaseData, IGetScanScheduleDefaultUseCaseError>>;
}

export const GetScanScheduleDefaultUseCase = createAbstraction<IGetScanScheduleDefaultUseCase>(
    "Api/GetScanScheduleDefaultUseCase"
);

export namespace GetScanScheduleDefaultUseCase {
    export type Interface = IGetScanScheduleDefaultUseCase;
    export type Params = IGetScanScheduleDefaultUseCaseParams;
    export type Data = IGetScanScheduleDefaultUseCaseData;
    export type Error = IGetScanScheduleDefaultUseCaseError;
}
