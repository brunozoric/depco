import { createFeature } from "#shared/index.js";

import { DependencyGraphPageFeature } from "./GraphPage/feature.js";
import { DependencyGraphUseCasesFeature } from "./useCases/feature.js";

export const DependencyGraphDomainFeature = createFeature({
    name: "Ui/Presentation/DependencyGraph",
    dependencies: [DependencyGraphPageFeature, DependencyGraphUseCasesFeature],
    register() {}
});
