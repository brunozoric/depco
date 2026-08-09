import { CancelJobUseCase as Abstraction } from "./abstractions/CancelJobUseCase.js";
import { JobsGateway } from "../../../../features/Jobs/abstractions/JobsGateway.js";
import { JobsRepository } from "../../../../features/Jobs/abstractions/JobsRepository.js";

class CancelJobUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly jobsGateway: JobsGateway.Interface,
        private readonly jobsRepository: JobsRepository.Interface
    ) {}

    public execute = async (jobId: string): Promise<void> => {
        this.jobsRepository.updateJobStatus(jobId, "cancelled");
        await this.jobsGateway.cancel(jobId);
    };
}

export const CancelJobUseCase = Abstraction.createImplementation({
    implementation: CancelJobUseCaseImpl,
    dependencies: [JobsGateway, JobsRepository]
});
