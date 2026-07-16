import { DeleteJobsUseCase as Abstraction } from "./abstractions/DeleteJobsUseCase.js";
import { JobsGateway } from "../../../../features/jobs/abstractions/JobsGateway.js";

class DeleteJobsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: JobsGateway.Interface) {}

    public execute = async (filters: JobsGateway.Filters): Promise<number> => {
        return this.gateway.deleteFiltered(filters);
    };
}

export const DeleteJobsUseCase = Abstraction.createImplementation({
    implementation: DeleteJobsUseCaseImpl,
    dependencies: [JobsGateway]
});
