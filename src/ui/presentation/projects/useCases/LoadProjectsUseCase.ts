import { LoadProjectsUseCase as Abstraction } from "./abstractions/LoadProjectsUseCase.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";

class LoadProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const projects = await this.projectsGateway.list();
        this.projectsRepository.setProjects(projects);
    };
}

export const LoadProjectsUseCase = Abstraction.createImplementation({
    implementation: LoadProjectsUseCaseImpl,
    dependencies: [ProjectsGateway, ProjectsRepository]
});
