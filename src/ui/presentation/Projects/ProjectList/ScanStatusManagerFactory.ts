import { ScanStatusManagerFactory as Abstraction } from "./abstractions/ScanStatusManagerFactory.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import { ScanProjectUseCase } from "../useCases/abstractions/ScanProjectUseCase.js";
import { CheckSecurityUseCase } from "../useCases/abstractions/CheckSecurityUseCase.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { ScanStatusManager } from "./ScanStatusManager.js";

class ScanStatusManagerFactoryImpl implements Abstraction.Interface {
    public constructor(
        private readonly eventBridge: EventBridge.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly scanProjectUseCase: ScanProjectUseCase.Interface,
        private readonly checkSecurityUseCase: CheckSecurityUseCase.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface
    ) {}

    public create(): Abstraction.Manager {
        return new ScanStatusManager({
            eventBridge: this.eventBridge,
            loadProjectsUseCase: this.loadProjectsUseCase,
            scanProjectUseCase: this.scanProjectUseCase,
            checkSecurityUseCase: this.checkSecurityUseCase,
            projectsRepository: this.projectsRepository
        });
    }
}

export const ScanStatusManagerFactory = Abstraction.createImplementation({
    implementation: ScanStatusManagerFactoryImpl,
    dependencies: [
        EventBridge,
        LoadProjectsUseCase,
        ScanProjectUseCase,
        CheckSecurityUseCase,
        ProjectsRepository
    ]
});
