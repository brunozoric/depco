import { ManageTeamUseCase as Abstraction } from "./abstractions/ManageTeamUseCase.js";
import { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamsRepository } from "../../../features/Teams/abstractions/TeamsRepository.js";

class ManageTeamUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: TeamsGateway.Interface,
        private readonly repository: TeamsRepository.Interface
    ) {}

    public create = async (input: TeamsGateway.CreateInput): Promise<TeamsGateway.WithStats> => {
        const created = await this.gateway.create(input);
        await this.refreshTeams();
        return created;
    };

    public update = async (id: string, input: TeamsGateway.UpdateInput): Promise<void> => {
        await this.gateway.update(id, input);
        await this.refreshTeams();
    };

    public remove = async (id: string): Promise<void> => {
        await this.gateway.remove(id);
        await this.refreshTeams();
    };

    private refreshTeams = async (): Promise<void> => {
        const response = await this.gateway.list();
        this.repository.setTeams(response.items);
    };
}

export const ManageTeamUseCase = Abstraction.createImplementation({
    implementation: ManageTeamUseCaseImpl,
    dependencies: [TeamsGateway, TeamsRepository]
});
