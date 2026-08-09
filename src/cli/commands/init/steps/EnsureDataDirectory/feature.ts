import { createFeature } from "#shared/index.js";
import { EnsureDataDirectoryStep } from "./EnsureDataDirectoryStep.js";

export const EnsureDataDirectoryStepFeature = createFeature({
    name: "Cli/EnsureDataDirectoryStep",
    register(container) {
        container.register(EnsureDataDirectoryStep).inSingletonScope();
    }
});
