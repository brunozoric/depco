import { createFeature } from "#shared/index.js";
import { OutputFormatterFeature } from "../../formatters/feature.js";
import { RenderOutputStep } from "./RenderOutputStep.js";

export const RenderOutputStepFeature = createFeature({
    name: "Cli/RenderOutputStep",
    dependencies: [OutputFormatterFeature],
    register(container) {
        container.register(RenderOutputStep).inSingletonScope();
    }
});
