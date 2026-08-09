import { createFeature } from "#shared/index.js";
import { BackupFeature } from "../../../features/Backup/feature.js";
import { ExportBackupUseCase } from "./ExportBackupUseCase.js";
import { ImportBackupUseCase } from "./ImportBackupUseCase.js";

export const BackupUseCasesFeature = createFeature({
    name: "Ui/BackupUseCases",
    dependencies: [BackupFeature],
    register(container) {
        container.register(ExportBackupUseCase);
        container.register(ImportBackupUseCase);
    }
});
