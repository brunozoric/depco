import { createAbstraction } from "#shared/index.js";
import type { BackupGateway } from "../../../../features/Backup/abstractions/BackupGateway.js";

export interface IExportBackupUseCase {
    execute(): Promise<BackupGateway.BackupPayload>;
}

export const ExportBackupUseCase =
    createAbstraction<IExportBackupUseCase>("Ui/ExportBackupUseCase");

export namespace ExportBackupUseCase {
    export type Interface = IExportBackupUseCase;
}
