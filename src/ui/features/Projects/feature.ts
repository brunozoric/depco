import { createFeature } from "#shared/index.js";
import { ProjectsGateway } from "./ProjectsGateway.js";
import { ProjectsRepository } from "./ProjectsRepository.js";

export const ProjectsFeature = createFeature({
    name: "Ui/Projects",
    register(container) {
        container.register(ProjectsGateway).inSingletonScope();
        container.register(ProjectsRepository).inSingletonScope();
    }
});
