import { createFeature } from "#shared/index.js";

import { UpgradesUseCasesFeature } from "./useCases/feature.js";

export const UpgradesDomainFeature = createFeature({
    name: "Ui/Presentation/Upgrades",
    dependencies: [UpgradesUseCasesFeature],
    register() {}
});
