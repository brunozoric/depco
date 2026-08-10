import { createFeature } from "#shared/index.js";
import { ValidateConfigStepFeature } from "./steps/ValidateConfig/index.js";
import { ConfigCheckCommand } from "./ConfigCheckCommand.js";

export const ConfigCheckCommandFeature = createFeature({
    name: "Cli/ConfigCheckCommand",
    dependencies: [ValidateConfigStepFeature],
    register(container) {
        container.register(ConfigCheckCommand).inSingletonScope();
    }
});
