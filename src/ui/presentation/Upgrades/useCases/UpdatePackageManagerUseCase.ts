import { UpdatePackageManagerUseCase as Abstraction } from "./abstractions/UpdatePackageManagerUseCase.js";
import { UpgradesGateway } from "../../../features/Upgrades/abstractions/UpgradesGateway.js";
import { UpgradesRepository } from "../../../features/Upgrades/abstractions/UpgradesRepository.js";

class UpdatePackageManagerUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface
    ) {}

    public execute = async (projectId: string, version: string): Promise<void> => {
        const { jobId } = await this.upgradesGateway.updatePackageManager(projectId, version);
        this.upgradesRepository.setActiveJob(projectId, {
            id: jobId,
            referenceId: projectId,
            referenceType: "project",
            type: "yarn",
            status: "pending",
            packages: null,
            logs: null,
            startedAt: null,
            completedAt: null,
            warning: null,
            progress: null,
            progressLabel: null
        });
    };
}

export const UpdatePackageManagerUseCase = Abstraction.createImplementation({
    implementation: UpdatePackageManagerUseCaseImpl,
    dependencies: [UpgradesGateway, UpgradesRepository]
});
