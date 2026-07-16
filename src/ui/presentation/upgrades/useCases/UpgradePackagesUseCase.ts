import { UpgradePackagesUseCase as Abstraction } from "./abstractions/UpgradePackagesUseCase.js";
import { UpgradesGateway } from "../../../features/upgrades/abstractions/UpgradesGateway.js";
import { UpgradesRepository } from "../../../features/upgrades/abstractions/UpgradesRepository.js";

class UpgradePackagesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface
    ) {}

    public execute = async (
        projectId: string,
        packages: Abstraction.PackageInput[],
        refreshTransient: boolean
    ): Promise<void> => {
        const { jobId } = await this.upgradesGateway.startUpgrade(
            projectId,
            packages,
            refreshTransient
        );
        this.upgradesRepository.setActiveJob(projectId, {
            id: jobId,
            referenceId: projectId,
            referenceType: "project",
            type: "dependency",
            status: "pending",
            packages: JSON.stringify(packages),
            logs: null,
            startedAt: null,
            completedAt: null,
            warning: null,
            progress: null,
            progressLabel: null
        });
    };
}

export const UpgradePackagesUseCase = Abstraction.createImplementation({
    implementation: UpgradePackagesUseCaseImpl,
    dependencies: [UpgradesGateway, UpgradesRepository]
});
