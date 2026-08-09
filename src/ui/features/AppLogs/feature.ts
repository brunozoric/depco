import { createFeature } from "#shared/index.js";
import { AppLogsGateway } from "./AppLogsGateway.js";
import { AppLogsRepository } from "./AppLogsRepository.js";

export const AppLogsFeature = createFeature({
    name: "Ui/AppLogs",
    register(container) {
        container.register(AppLogsGateway).inSingletonScope();
        container.register(AppLogsRepository).inSingletonScope();
    }
});
