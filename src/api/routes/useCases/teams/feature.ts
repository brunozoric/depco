import { createFeature } from "#shared/index.js";
import { ListTeamsUseCase } from "./ListTeamsUseCase.js";
import { CreateTeamUseCase } from "./CreateTeamUseCase.js";
import { GetTeamUseCase } from "./GetTeamUseCase.js";
import { UpdateTeamUseCase } from "./UpdateTeamUseCase.js";
import { SetTeamProjectsUseCase } from "./SetTeamProjectsUseCase.js";
import { DeleteTeamUseCase } from "./DeleteTeamUseCase.js";

export const TeamsUseCasesFeature = createFeature({
    name: "Api/TeamsUseCasesFeature",
    register(container) {
        container.register(ListTeamsUseCase);
        container.register(CreateTeamUseCase);
        container.register(GetTeamUseCase);
        container.register(UpdateTeamUseCase);
        container.register(SetTeamProjectsUseCase);
        container.register(DeleteTeamUseCase);
    }
});
