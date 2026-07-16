import { GetJobUseCase as Abstraction } from "./abstractions/GetJobUseCase.js";
import { UpgradesGateway } from "../../../features/upgrades/abstractions/UpgradesGateway.js";
import { UpgradesRepository } from "../../../features/upgrades/abstractions/UpgradesRepository.js";

class GetJobUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface
    ) {}

    public execute = async (projectId: string, jobId: string): Promise<void> => {
        const job = await this.upgradesGateway.getJob(projectId, jobId);
        this.upgradesRepository.setActiveJob(projectId, job);
    };
}

export const GetJobUseCase = Abstraction.createImplementation({
    implementation: GetJobUseCaseImpl,
    dependencies: [UpgradesGateway, UpgradesRepository]
});
