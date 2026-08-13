import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteScanScheduleUseCaseParams {
    projectId: string;
}

export interface IDeleteScanScheduleUseCaseError {
    statusCode: number;
    message: string;
}

export interface IDeleteScanScheduleUseCase {
    execute(
        params: IDeleteScanScheduleUseCaseParams
    ): Promise<Result<void, IDeleteScanScheduleUseCaseError>>;
}

export const DeleteScanScheduleUseCase = createAbstraction<IDeleteScanScheduleUseCase>(
    "Api/DeleteScanScheduleUseCase"
);

export namespace DeleteScanScheduleUseCase {
    export type Interface = IDeleteScanScheduleUseCase;
    export type Params = IDeleteScanScheduleUseCaseParams;
    export type Error = IDeleteScanScheduleUseCaseError;
}
