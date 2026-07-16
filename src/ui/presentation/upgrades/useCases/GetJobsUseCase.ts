import { GetJobsUseCase as Abstraction } from "./abstractions/GetJobsUseCase.js";
import { UpgradesGateway } from "../../../features/upgrades/abstractions/UpgradesGateway.js";
import { UpgradesRepository } from "../../../features/upgrades/abstractions/UpgradesRepository.js";

class GetJobsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        const jobs = await this.upgradesGateway.getJobs(projectId);
        this.upgradesRepository.setJobs(projectId, jobs);
    };
}

export const GetJobsUseCase = Abstraction.createImplementation({
    implementation: GetJobsUseCaseImpl,
    dependencies: [UpgradesGateway, UpgradesRepository]
});
