import { CheckSecurityUseCase as Abstraction } from "./abstractions/CheckSecurityUseCase.js";
import { ProjectsGateway } from "../../../features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";

class CheckSecurityUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {}

    public execute = async (id: string): Promise<void> => {
        const securityStatus = await this.projectsGateway.checkSecurity(id);
        this.projectsRepository.setSecurityStatus(id, securityStatus);
    };
}

export const CheckSecurityUseCase = Abstraction.createImplementation({
    implementation: CheckSecurityUseCaseImpl,
    dependencies: [ProjectsGateway, ProjectsRepository]
});
