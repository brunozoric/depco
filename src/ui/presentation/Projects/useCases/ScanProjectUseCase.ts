import { ScanProjectUseCase as Abstraction } from "./abstractions/ScanProjectUseCase.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";

class ScanProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly projectsGateway: ProjectsGateway.Interface) {}

    public execute = async (id: string, force?: boolean): Promise<string> => {
        const { jobId } = await this.projectsGateway.scan(id, force);
        return jobId;
    };
}

export const ScanProjectUseCase = Abstraction.createImplementation({
    implementation: ScanProjectUseCaseImpl,
    dependencies: [ProjectsGateway]
});
