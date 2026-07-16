import { createFeature } from "#shared/index.js";
import { AppLogsFeature } from "../../../features/appLogs/feature.js";
import { LoadAppLogsUseCase } from "./LoadAppLogsUseCase.js";
import { DeleteAppLogsUseCase } from "./DeleteAppLogsUseCase.js";

export const AppLogsUseCasesFeature = createFeature({
    name: "Ui/AppLogsUseCases",
    dependencies: [AppLogsFeature],
    register(container) {
        container.register(LoadAppLogsUseCase);
        container.register(DeleteAppLogsUseCase);
    }
});
