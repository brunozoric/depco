import { createFeature } from "#shared/index.js";

import { TrendsPageFeature } from "./TrendsPage/feature.js";
import { TrendsUseCasesFeature } from "./useCases/feature.js";

export const TrendsDomainFeature = createFeature({
    name: "Ui/Presentation/Trends",
    dependencies: [TrendsPageFeature, TrendsUseCasesFeature],
    register() {}
});
