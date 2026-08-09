import { createFeature } from "#shared/index.js";
import { GitService } from "./GitService.js";
import { ForgeService } from "./ForgeService.js";

export const GitFeature = createFeature({
    name: "Api/GitFeature",
    register(container) {
        container.register(GitService).inSingletonScope();
        container.register(ForgeService).inSingletonScope();
    }
});
