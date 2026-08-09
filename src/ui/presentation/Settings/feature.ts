import { createFeature } from "#shared/index.js";

import { AppSettingsPresentationFeature } from "./AppSettings/feature.js";
import { PmSettingsPresentationFeature } from "./PmSettings/feature.js";
import { AppSettingsUseCasesFeature } from "./appSettingsUseCases/feature.js";
import { SecuritySettingsUseCasesFeature } from "./useCases/feature.js";

export const SettingsDomainFeature = createFeature({
    name: "Ui/Presentation/Settings",
    dependencies: [
        PmSettingsPresentationFeature,
        AppSettingsPresentationFeature,
        SecuritySettingsUseCasesFeature,
        AppSettingsUseCasesFeature
    ],
    register() {}
});
