import { createAbstraction, Result } from "#shared/index.js";
import type { ILogFilters } from "../logsHelper.js";

export type IDeleteLogsUseCaseParams = ILogFilters;

export interface IDeleteLogsUseCaseData {
    deleted: number;
}

export interface IDeleteLogsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IDeleteLogsUseCase {
    execute(
        params: IDeleteLogsUseCaseParams
    ): Promise<Result<IDeleteLogsUseCaseData, IDeleteLogsUseCaseError>>;
}

export const DeleteLogsUseCase = createAbstraction<IDeleteLogsUseCase>("Api/DeleteLogsUseCase");

export namespace DeleteLogsUseCase {
    export type Interface = IDeleteLogsUseCase;
    export type Params = IDeleteLogsUseCaseParams;
    export type Data = IDeleteLogsUseCaseData;
    export type Error = IDeleteLogsUseCaseError;
}
