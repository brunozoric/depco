import { createFeature } from "#shared/index.js";
import { TeamsFeature } from "../../../features/teams/feature.js";
import { LoadTeamsUseCase } from "./LoadTeamsUseCase.js";
import { ManageTeamUseCase } from "./ManageTeamUseCase.js";

export const TeamsUseCasesFeature = createFeature({
    name: "Ui/TeamsUseCases",
    dependencies: [TeamsFeature],
    register(container) {
        container.register(LoadTeamsUseCase);
        container.register(ManageTeamUseCase);
    }
});
