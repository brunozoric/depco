import { createFeature } from "#shared/index.js";

import { BackupPresentationFeature } from "./BackupPage/feature.js";
import { BackupUseCasesFeature } from "./useCases/feature.js";

export const BackupDomainFeature = createFeature({
    name: "Ui/Presentation/Backup",
    dependencies: [BackupPresentationFeature, BackupUseCasesFeature],
    register() {}
});
