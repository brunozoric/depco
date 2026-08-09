import { createAbstraction } from "#shared/index.js";
import type { BackupGateway } from "../../../../features/Backup/abstractions/BackupGateway.js";

export interface IImportBackupUseCase {
    execute(payload: BackupGateway.BackupPayload): Promise<BackupGateway.ImportResult>;
}

export const ImportBackupUseCase =
    createAbstraction<IImportBackupUseCase>("Ui/ImportBackupUseCase");

export namespace ImportBackupUseCase {
    export type Interface = IImportBackupUseCase;
}
