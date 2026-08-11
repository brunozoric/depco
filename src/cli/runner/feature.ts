import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { createFeature } from "#shared/index.js";
import { StepRunner } from "./StepRunner.js";

export const StepRunnerFeature = createFeature({
    name: "Cli/StepRunner",
    register(container) {
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "info" as const })
        });
        ConsoleLoggerFeature.register(container);
        container.register(StepRunner).inSingletonScope();
    }
});
