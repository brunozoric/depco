import { createAbstraction, Result } from "#shared/index.js";
import type { IAppLogRecord, ILogFilters } from "../logsHelper.js";

export interface IListLogsUseCaseParams extends ILogFilters {
    limit?: string | undefined;
    offset?: string | undefined;
}

export interface IListLogsUseCaseData {
    items: IAppLogRecord[];
    total: number;
}

export interface IListLogsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListLogsUseCase {
    execute(
        params: IListLogsUseCaseParams
    ): Promise<Result<IListLogsUseCaseData, IListLogsUseCaseError>>;
}

export const ListLogsUseCase = createAbstraction<IListLogsUseCase>("Api/ListLogsUseCase");

export namespace ListLogsUseCase {
    export type Interface = IListLogsUseCase;
    export type Params = IListLogsUseCaseParams;
    export type Data = IListLogsUseCaseData;
    export type Error = IListLogsUseCaseError;
}
