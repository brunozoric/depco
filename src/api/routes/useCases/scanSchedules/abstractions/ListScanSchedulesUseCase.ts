import { createAbstraction, Result } from "#shared/index.js";
import type { IResolvedScanScheduleResponse } from "../scanScheduleHelper.js";

export interface IListScanSchedulesUseCaseParams {}

export interface IListScanSchedulesUseCaseData {
    items: IResolvedScanScheduleResponse[];
    globalDefault: string;
}

export interface IListScanSchedulesUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListScanSchedulesUseCase {
    execute(
        params: IListScanSchedulesUseCaseParams
    ): Promise<Result<IListScanSchedulesUseCaseData, IListScanSchedulesUseCaseError>>;
}

export const ListScanSchedulesUseCase = createAbstraction<IListScanSchedulesUseCase>(
    "Api/ListScanSchedulesUseCase"
);

export namespace ListScanSchedulesUseCase {
    export type Interface = IListScanSchedulesUseCase;
    export type Params = IListScanSchedulesUseCaseParams;
    export type Data = IListScanSchedulesUseCaseData;
    export type Error = IListScanSchedulesUseCaseError;
}
