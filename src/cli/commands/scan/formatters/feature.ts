import { createFeature } from "#shared/index.js";
import { OutputFormatterFactory } from "./OutputFormatterFactory.js";

export const OutputFormatterFeature = createFeature({
    name: "Cli/OutputFormatterFactory",
    register(container) {
        container.register(OutputFormatterFactory).inSingletonScope();
    }
});
