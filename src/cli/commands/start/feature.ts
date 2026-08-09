import { createFeature } from "#shared/index.js";
import { ValidateEnvironmentStepFeature } from "./steps/ValidateEnvironment/index.js";
import { StartServerStepFeature } from "./steps/StartServer/index.js";
import { StartCommand } from "./StartCommand.js";

export const StartCommandFeature = createFeature({
    name: "Cli/StartCommand",
    dependencies: [ValidateEnvironmentStepFeature, StartServerStepFeature],
    register(container) {
        container.register(StartCommand).inSingletonScope();
    }
});
