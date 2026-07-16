import { createFeature } from "#shared/index.js";
import { FilesystemGateway } from "./FilesystemGateway.js";

export const FilesystemFeature = createFeature({
    name: "Ui/FilesystemFeature",
    register(container) {
        container.register(FilesystemGateway).inSingletonScope();
    }
});
