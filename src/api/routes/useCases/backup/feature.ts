import { createFeature } from "#shared/index.js";
import { ExportBackupUseCase } from "./ExportBackupUseCase.js";
import { ImportBackupUseCase } from "./ImportBackupUseCase.js";

export const BackupUseCasesFeature = createFeature({
    name: "Api/BackupUseCasesFeature",
    register(container) {
        container.register(ExportBackupUseCase);
        container.register(ImportBackupUseCase);
    }
});
