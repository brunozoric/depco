import { createFeature } from "#shared/index.js";
import { StepRunnerFeature } from "./runner/index.js";
import { InitCommandFeature } from "./commands/init/index.js";
import { StartCommandFeature } from "./commands/start/index.js";

export const CliFeature = createFeature({
    name: "Cli",
    dependencies: [StepRunnerFeature, InitCommandFeature, StartCommandFeature],
    register() {}
});
