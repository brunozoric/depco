import { createFeature } from "#shared/index.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { LoadProjectsUseCase } from "./LoadProjectsUseCase.js";
import { AddProjectUseCase } from "./AddProjectUseCase.js";
import { RemoveProjectUseCase } from "./RemoveProjectUseCase.js";
import { ScanProjectUseCase } from "./ScanProjectUseCase.js";
import { CheckSecurityUseCase } from "./CheckSecurityUseCase.js";
import { CloneProjectUseCase } from "./CloneProjectUseCase.js";

export const ProjectsUseCasesFeature = createFeature({
    name: "Ui/ProjectsUseCases",
    dependencies: [ProjectsFeature],
    register(container) {
        container.register(LoadProjectsUseCase);
        container.register(AddProjectUseCase);
        container.register(RemoveProjectUseCase);
        container.register(ScanProjectUseCase);
        container.register(CheckSecurityUseCase);
        container.register(CloneProjectUseCase);
    }
});
