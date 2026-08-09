import { createFeature } from "#shared/index.js";
import { LockfileParserService } from "./LockfileParserService.js";
import { DependencyGraphService } from "./DependencyGraphService.js";

export const DependencyGraphFeature = createFeature({
    name: "Api/DependencyGraphFeature",
    register(container) {
        container.register(LockfileParserService).inSingletonScope();
        container.register(DependencyGraphService).inSingletonScope();
    }
});
