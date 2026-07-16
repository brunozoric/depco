import { createAbstraction } from "#shared/index.js";

export interface IExportSbomUseCase {
    exportProject(projectId: string, format: string): Promise<void>;
    exportAll(format: string): Promise<void>;
}

export const ExportSbomUseCase = createAbstraction<IExportSbomUseCase>("Ui/ExportSbomUseCase");

export namespace ExportSbomUseCase {
    export type Interface = IExportSbomUseCase;
}
