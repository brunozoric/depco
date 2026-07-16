import { RefreshTransientUseCase as Abstraction } from "./abstractions/RefreshTransientUseCase.js";
import { UpgradesGateway } from "../../../features/upgrades/abstractions/UpgradesGateway.js";
import { UpgradesRepository } from "../../../features/upgrades/abstractions/UpgradesRepository.js";

class RefreshTransientUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly upgradesRepository: UpgradesRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        const { jobId } = await this.upgradesGateway.startTransient(projectId);
        this.upgradesRepository.setActiveJob(projectId, {
            id: jobId,
            referenceId: projectId,
            referenceType: "project",
            type: "transient",
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

export const RefreshTransientUseCase = Abstraction.createImplementation({
    implementation: RefreshTransientUseCaseImpl,
    dependencies: [UpgradesGateway, UpgradesRepository]
});
