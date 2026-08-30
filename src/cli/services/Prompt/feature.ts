import { createFeature } from "#shared/index.js";
import { ClackPromptService } from "./ClackPromptService.js";

export const PromptServiceFeature = createFeature({
    name: "Cli/PromptService",
    register(container) {
        container.register(ClackPromptService).inSingletonScope();
    }
});
