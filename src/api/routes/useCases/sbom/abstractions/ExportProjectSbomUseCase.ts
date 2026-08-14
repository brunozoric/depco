import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface IExportProjectSbomUseCaseParams {
    projectId: string;
    format: string;
}

export interface IExportProjectSbomUseCaseData {
    content: Record<string, unknown>;
    filename: string;
    mediaType: string;
}

export interface IExportProjectSbomUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type ExportProjectSbomUseCaseError =
    IExportProjectSbomUseCaseErrors[keyof IExportProjectSbomUseCaseErrors];

export interface IExportProjectSbomUseCase {
    execute(
        params: IExportProjectSbomUseCaseParams
    ): Promise<Result<IExportProjectSbomUseCaseData, ExportProjectSbomUseCaseError>>;
}

export const ExportProjectSbomUseCase = createAbstraction<IExportProjectSbomUseCase>(
    "Api/ExportProjectSbomUseCase"
);

export namespace ExportProjectSbomUseCase {
    export type Interface = IExportProjectSbomUseCase;
    export type Params = IExportProjectSbomUseCaseParams;
    export type Data = IExportProjectSbomUseCaseData;
    export type Error = ExportProjectSbomUseCaseError;
}
