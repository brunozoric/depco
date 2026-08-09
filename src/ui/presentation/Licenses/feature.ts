import { createFeature } from "#shared/index.js";

import { LicenseListFeature } from "./LicensesList/feature.js";
import { LicensesUseCasesFeature } from "./useCases/feature.js";

export const LicensesDomainFeature = createFeature({
    name: "Ui/Presentation/Licenses",
    dependencies: [LicenseListFeature, LicensesUseCasesFeature],
    register() {}
});
