import { createFeature } from "#shared/index.js";
import { BrowseFilesystemUseCase } from "./BrowseFilesystemUseCase.js";
import { ScanFilesystemUseCase } from "./ScanFilesystemUseCase.js";

export const FilesystemUseCasesFeature = createFeature({
    name: "Api/FilesystemUseCasesFeature",
    register(container) {
        container.register(BrowseFilesystemUseCase);
        container.register(ScanFilesystemUseCase);
    }
});
