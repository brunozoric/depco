import { createFeature } from "#shared/index.js";
import { NodeReleaseDataService } from "./NodeReleaseDataService.js";
import { EngineService } from "./EngineService.js";

export const EngineFeature = createFeature({
    name: "Api/EngineFeature",
    register(container) {
        container.register(NodeReleaseDataService).inSingletonScope();
        container.register(EngineService).inSingletonScope();
    }
});
