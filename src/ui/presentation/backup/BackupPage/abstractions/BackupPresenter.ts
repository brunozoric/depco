import { createAbstraction } from "#shared/index.js";
import type { BackupGateway } from "../../../../features/backup/abstractions/BackupGateway.js";

export interface IBackupViewModel {
    loading: boolean;
    error: string | null;
    importResult: BackupGateway.ImportResult | null;
}

export interface IBackupPresenter {
    get vm(): IBackupViewModel;
    exportBackup: () => Promise<void>;
    importBackup: (file: File) => Promise<void>;
    clearResult: () => void;
}

export const BackupPresenter = createAbstraction<IBackupPresenter>("Ui/BackupPresenter");

export namespace BackupPresenter {
    export type Interface = IBackupPresenter;
    export type ViewModel = IBackupViewModel;
}
