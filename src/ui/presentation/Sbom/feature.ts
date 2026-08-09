import { createFeature } from "#shared/index.js";

import { SbomPageFeature } from "./SbomPage/feature.js";
import { SbomUseCasesFeature } from "./useCases/feature.js";

export const SbomDomainFeature = createFeature({
    name: "Ui/Presentation/Sbom",
    dependencies: [SbomPageFeature, SbomUseCasesFeature],
    register() {}
});
