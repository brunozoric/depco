import { createAbstraction, Result } from "#shared/index.js";
import type { IBackupPayload } from "../backupTypes.js";

export interface IExportBackupUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IExportBackupUseCase {
    execute(): Promise<Result<IBackupPayload, IExportBackupUseCaseError>>;
}

export const ExportBackupUseCase =
    createAbstraction<IExportBackupUseCase>("Api/ExportBackupUseCase");

export namespace ExportBackupUseCase {
    export type Interface = IExportBackupUseCase;
    export type Data = IBackupPayload;
    export type Error = IExportBackupUseCaseError;
}
