import { ImportBackupUseCase as Abstraction } from "./abstractions/ImportBackupUseCase.js";
import { BackupGateway } from "../../../features/backup/abstractions/BackupGateway.js";

class ImportBackupUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: BackupGateway.Interface) {}

    public execute = async (
        payload: BackupGateway.BackupPayload
    ): Promise<BackupGateway.ImportResult> => {
        return this.gateway.importBackup(payload);
    };
}

export const ImportBackupUseCase = Abstraction.createImplementation({
    implementation: ImportBackupUseCaseImpl,
    dependencies: [BackupGateway]
});
