import { createFeature } from "#shared/index.js";
import { WriteEnvFileStep } from "./WriteEnvFileStep.js";

export const WriteEnvFileStepFeature = createFeature({
    name: "Cli/WriteEnvFileStep",
    register(container) {
        container.register(WriteEnvFileStep).inSingletonScope();
    }
});
