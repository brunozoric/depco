import { createFeature } from "#shared/index.js";
import { CommandRunner } from "./CommandRunner.js";

export const CommandRunnerFeature = createFeature({
    name: "Api/CommandRunnerFeature",
    register(container) {
        container.register(CommandRunner).inSingletonScope();
    }
});
