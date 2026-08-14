import { createFeature } from "#shared/index.js";
import { CreateProjectUseCase } from "./CreateProjectUseCase.js";
import { ListProjectsUseCase } from "./ListProjectsUseCase.js";
import { GetProjectUseCase } from "./GetProjectUseCase.js";
import { DeleteProjectUseCase } from "./DeleteProjectUseCase.js";
import { ScanProjectUseCase } from "./ScanProjectUseCase.js";
import { GetProjectDependenciesUseCase } from "./GetProjectDependenciesUseCase.js";
import { GetTransitiveResolveStatusUseCase } from "./GetTransitiveResolveStatusUseCase.js";
import { GetProjectSecurityUseCase } from "./GetProjectSecurityUseCase.js";
import { CheckProjectSecurityUseCase } from "./CheckProjectSecurityUseCase.js";
import { GetProjectTeamsUseCase } from "./GetProjectTeamsUseCase.js";
import { SetProjectTeamsUseCase } from "./SetProjectTeamsUseCase.js";
import { ExportProjectsUseCase } from "./ExportProjectsUseCase.js";
import { ImportProjectsUseCase } from "./ImportProjectsUseCase.js";
import { CloneProjectUseCase } from "./CloneProjectUseCase.js";
import { BulkScanProjectsUseCase } from "./BulkScanProjectsUseCase.js";
import { UpdateProjectUseCase } from "./UpdateProjectUseCase.js";

export const ProjectsUseCasesFeature = createFeature({
    name: "Api/ProjectsUseCasesFeature",
    register(container) {
        container.register(CreateProjectUseCase);
        container.register(ListProjectsUseCase);
        container.register(GetProjectUseCase);
        container.register(DeleteProjectUseCase);
        container.register(ScanProjectUseCase);
        container.register(GetProjectDependenciesUseCase);
        container.register(GetTransitiveResolveStatusUseCase);
        container.register(GetProjectSecurityUseCase);
        container.register(CheckProjectSecurityUseCase);
        container.register(GetProjectTeamsUseCase);
        container.register(SetProjectTeamsUseCase);
        container.register(ExportProjectsUseCase);
        container.register(ImportProjectsUseCase);
        container.register(CloneProjectUseCase);
        container.register(BulkScanProjectsUseCase);
        container.register(UpdateProjectUseCase);
    }
});
