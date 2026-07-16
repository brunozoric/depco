import { CloneProjectUseCase as Abstraction } from "./abstractions/CloneProjectUseCase.js";
import { ProjectsGateway } from "../../../features/projects/abstractions/ProjectsGateway.js";

class CloneProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly projectsGateway: ProjectsGateway.Interface) {}

    public execute = async (
        url: string,
        destination: string,
        folderName?: string
    ): Promise<string> => {
        const result = await this.projectsGateway.clone(url, destination, folderName);
        return result.jobId;
    };
}

export const CloneProjectUseCase = Abstraction.createImplementation({
    implementation: CloneProjectUseCaseImpl,
    dependencies: [ProjectsGateway]
});
