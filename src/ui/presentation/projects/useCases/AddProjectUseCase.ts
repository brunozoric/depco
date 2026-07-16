import { AddProjectUseCase as Abstraction } from "./abstractions/AddProjectUseCase.js";
import { ProjectsGateway } from "../../../features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";

class AddProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {}

    public execute = async (path: string): Promise<void> => {
        const project = await this.projectsGateway.create(path);
        this.projectsRepository.setProjects([...this.projectsRepository.getProjects(), project]);
    };
}

export const AddProjectUseCase = Abstraction.createImplementation({
    implementation: AddProjectUseCaseImpl,
    dependencies: [ProjectsGateway, ProjectsRepository]
});
