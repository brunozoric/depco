import { createFeature } from "#shared/index.js";

import { AutoFixUseCasesFeature } from "./useCases/feature.js";

export const AutoFixPresentationFeature = createFeature({
    name: "Ui/Presentation/AutoFix",
    dependencies: [AutoFixUseCasesFeature],
    register() {}
});
