import { createFeature } from "#shared/index.js";
import { FileConfigService } from "./FileConfigService.js";

export const FileConfigFeature = createFeature({
    name: "Api/FileConfigFeature",
    register(container) {
        container.register(FileConfigService).inSingletonScope();
    }
});
