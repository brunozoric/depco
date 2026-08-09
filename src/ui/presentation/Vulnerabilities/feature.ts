import { createFeature } from "#shared/index.js";

import { VulnerabilityDetailFeature } from "./VulnerabilityDetail/feature.js";
import { VulnerabilityListFeature } from "./VulnerabilityList/feature.js";
import { VulnerabilitiesUseCasesFeature } from "./useCases/feature.js";

export const VulnerabilitiesDomainFeature = createFeature({
    name: "Ui/Presentation/Vulnerabilities",
    dependencies: [
        VulnerabilityDetailFeature,
        VulnerabilityListFeature,
        VulnerabilitiesUseCasesFeature
    ],
    register() {}
});
