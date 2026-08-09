import { createFeature } from "#shared/index.js";
import { PmSettingsGateway } from "./PmSettingsGateway.js";
import { PmSettingsRepository } from "./PmSettingsRepository.js";

export const PmSettingsFeature = createFeature({
    name: "Ui/PmSettings",
    register(container) {
        container.register(PmSettingsGateway).inSingletonScope();
        container.register(PmSettingsRepository).inSingletonScope();
    }
});
