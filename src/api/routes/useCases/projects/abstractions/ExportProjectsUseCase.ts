import { createAbstraction, Result } from "#shared/index.js";

export interface IExportProjectsUseCaseParams {}

export interface IExportedProject {
    path: string;
}

export interface IExportProjectsUseCaseData {
    items: IExportedProject[];
    total: number;
}

export interface IExportProjectsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IExportProjectsUseCase {
    execute(
        params: IExportProjectsUseCaseParams
    ): Promise<Result<IExportProjectsUseCaseData, IExportProjectsUseCaseError>>;
}

export const ExportProjectsUseCase = createAbstraction<IExportProjectsUseCase>(
    "Api/ExportProjectsUseCase"
);

export namespace ExportProjectsUseCase {
    export type Interface = IExportProjectsUseCase;
    export type Params = IExportProjectsUseCaseParams;
    export type ExportedProject = IExportedProject;
    export type Data = IExportProjectsUseCaseData;
    export type Error = IExportProjectsUseCaseError;
}
