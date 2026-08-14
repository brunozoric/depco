import { createAbstraction, Result } from "#shared/index.js";

export interface IImportProjectItem {
    path: string;
}

export interface IImportProjectsUseCaseParams {
    items: IImportProjectItem[];
}

export type ImportProjectResultStatus = "added" | "skipped" | "failed";

export interface IImportProjectResult {
    path: string;
    status: ImportProjectResultStatus;
    error?: string;
}

export interface IImportProjectsUseCaseData {
    items: IImportProjectResult[];
    total: number;
}

export interface IImportProjectsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IImportProjectsUseCase {
    execute(
        params: IImportProjectsUseCaseParams
    ): Promise<Result<IImportProjectsUseCaseData, IImportProjectsUseCaseError>>;
}

export const ImportProjectsUseCase = createAbstraction<IImportProjectsUseCase>(
    "Api/ImportProjectsUseCase"
);

export namespace ImportProjectsUseCase {
    export type Interface = IImportProjectsUseCase;
    export type Params = IImportProjectsUseCaseParams;
    export type ImportItem = IImportProjectItem;
    export type ImportResult = IImportProjectResult;
    export type Data = IImportProjectsUseCaseData;
    export type Error = IImportProjectsUseCaseError;
}
