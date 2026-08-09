import { ExportBackupUseCase as Abstraction } from "./abstractions/ExportBackupUseCase.js";
import { BackupGateway } from "../../../features/Backup/abstractions/BackupGateway.js";

class ExportBackupUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: BackupGateway.Interface) {}

    public execute = async (): Promise<BackupGateway.BackupPayload> => {
        return this.gateway.exportBackup();
    };
}

export const ExportBackupUseCase = Abstraction.createImplementation({
    implementation: ExportBackupUseCaseImpl,
    dependencies: [BackupGateway]
});
