import { createFeature } from "#shared/index.js";

import { LogBrowserPresentationFeature } from "./LogBrowser/feature.js";
import { AppLogsUseCasesFeature } from "./useCases/feature.js";

export const LogsDomainFeature = createFeature({
    name: "Ui/Presentation/Logs",
    dependencies: [LogBrowserPresentationFeature, AppLogsUseCasesFeature],
    register() {}
});
