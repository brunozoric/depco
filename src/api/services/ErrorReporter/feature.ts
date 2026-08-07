import { createFeature } from "#shared/index.js";
import { ErrorReporter } from "./ErrorReporter.js";

export const ErrorReporterFeature = createFeature({
    name: "Api/ErrorReporterFeature",
    register(container) {
        container.register(ErrorReporter).inSingletonScope();
    }
});
