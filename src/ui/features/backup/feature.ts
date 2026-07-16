import { createFeature } from "#shared/index.js";
import { BackupGateway } from "./BackupGateway.js";

export const BackupFeature = createFeature({
    name: "Ui/Backup",
    register(container) {
        container.register(BackupGateway).inSingletonScope();
    }
});
