import { LoadTeamsUseCase as Abstraction } from "./abstractions/LoadTeamsUseCase.js";
import { TeamsGateway } from "../../../features/teams/abstractions/TeamsGateway.js";
import { TeamsRepository } from "../../../features/teams/abstractions/TeamsRepository.js";

class LoadTeamsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: TeamsGateway.Interface,
        private readonly repository: TeamsRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const response = await this.gateway.list();
        this.repository.setTeams(response.items);
    };
}

export const LoadTeamsUseCase = Abstraction.createImplementation({
    implementation: LoadTeamsUseCaseImpl,
    dependencies: [TeamsGateway, TeamsRepository]
});
