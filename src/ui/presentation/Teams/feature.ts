import { createFeature } from "#shared/index.js";

import { TeamDetailFeature } from "./TeamDetail/feature.js";
import { TeamsPageFeature } from "./TeamsPage/feature.js";
import { TeamsUseCasesFeature } from "./useCases/feature.js";

export const TeamsDomainFeature = createFeature({
    name: "Ui/Presentation/Teams",
    dependencies: [TeamsPageFeature, TeamDetailFeature, TeamsUseCasesFeature],
    register() {}
});
