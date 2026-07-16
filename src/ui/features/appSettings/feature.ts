import { createFeature } from "#shared/index.js";
import { AppSettingsGateway } from "./AppSettingsGateway.js";
import { AppSettingsRepository } from "./AppSettingsRepository.js";

export const AppSettingsFeature = createFeature({
    name: "Ui/AppSettings",
    register(container) {
        container.register(AppSettingsGateway).inSingletonScope();
        container.register(AppSettingsRepository).inSingletonScope();
    }
});
