import { createFeature } from "#shared/index.js";
import { InquirerPromptService } from "./InquirerPromptService.js";

export const PromptServiceFeature = createFeature({
    name: "Cli/PromptService",
    register(container) {
        container.register(InquirerPromptService).inSingletonScope();
    }
});
