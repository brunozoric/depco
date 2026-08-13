import { RemoveProjectUseCase as Abstraction } from "./abstractions/RemoveProjectUseCase.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";

class RemoveProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {}

    public execute = async (id: string): Promise<void> => {
        await this.projectsGateway.remove(id);
        this.projectsRepository.setProjects(
            this.projectsRepository.getProjects().filter(project => project.id !== id),
            Math.max(0, this.projectsRepository.getProjectsTotal() - 1)
        );
        this.projectsRepository.clear(id);
    };
}

export const RemoveProjectUseCase = Abstraction.createImplementation({
    implementation: RemoveProjectUseCaseImpl,
    dependencies: [ProjectsGateway, ProjectsRepository]
});
