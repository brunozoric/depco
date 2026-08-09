import { createFeature } from "#shared/index.js";

import { PackageListFeature } from "./PackageList/feature.js";
import { PackagesUseCasesFeature } from "./useCases/feature.js";

export const PackagesDomainFeature = createFeature({
    name: "Ui/Presentation/Packages",
    dependencies: [PackageListFeature, PackagesUseCasesFeature],
    register() {}
});
