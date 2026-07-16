import { LoadAllJobsUseCase as Abstraction } from "./abstractions/LoadAllJobsUseCase.js";
import { JobsGateway } from "../../../../features/jobs/abstractions/JobsGateway.js";
import { JobsRepository } from "../../../../features/jobs/abstractions/JobsRepository.js";

class LoadAllJobsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly jobsGateway: JobsGateway.Interface,
        private readonly jobsRepository: JobsRepository.Interface
    ) {}

    public execute = async (
        filters: JobsGateway.Filters,
        limit?: number,
        offset?: number
    ): Promise<void> => {
        const response = await this.jobsGateway.listAll(filters, limit, offset);
        this.jobsRepository.setJobs(response.items);
        this.jobsRepository.setTotal(response.total);
    };
}

export const LoadAllJobsUseCase = Abstraction.createImplementation({
    implementation: LoadAllJobsUseCaseImpl,
    dependencies: [JobsGateway, JobsRepository]
});
