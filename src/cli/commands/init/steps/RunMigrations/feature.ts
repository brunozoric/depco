import { createFeature } from "#shared/index.js";
import { RunMigrationsStep } from "./RunMigrationsStep.js";

export const RunMigrationsStepFeature = createFeature({
    name: "Cli/RunMigrationsStep",
    register(container) {
        container.register(RunMigrationsStep).inSingletonScope();
    }
});
