import { createAbstraction, Result } from "#shared/index.js";

export interface IExportAllSbomUseCaseParams {
    format: string;
}

export interface IExportAllSbomUseCaseData {
    content: Record<string, unknown>;
    filename: string;
    mediaType: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IExportAllSbomUseCaseErrors {
    unexpected: IUnexpectedError;
}

type ExportAllSbomUseCaseError = IExportAllSbomUseCaseErrors[keyof IExportAllSbomUseCaseErrors];

export interface IExportAllSbomUseCase {
    execute(
        params: IExportAllSbomUseCaseParams
    ): Promise<Result<IExportAllSbomUseCaseData, ExportAllSbomUseCaseError>>;
}

export const ExportAllSbomUseCase = createAbstraction<IExportAllSbomUseCase>(
    "Api/ExportAllSbomUseCase"
);

export namespace ExportAllSbomUseCase {
    export type Interface = IExportAllSbomUseCase;
    export type Params = IExportAllSbomUseCaseParams;
    export type Data = IExportAllSbomUseCaseData;
    export type Error = ExportAllSbomUseCaseError;
}
