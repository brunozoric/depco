import { LoadAutoFixUseCase as Abstraction } from "./abstractions/LoadAutoFixUseCase.js";
import { AutoFixGateway } from "../../../features/AutoFix/abstractions/AutoFixGateway.js";
import { AutoFixRepository } from "../../../features/AutoFix/abstractions/AutoFixRepository.js";

class LoadAutoFixUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: AutoFixGateway.Interface,
        private readonly repository: AutoFixRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        const [settings, pullRequestsResponse] = await Promise.all([
            this.gateway.getSettings(projectId),
            this.gateway.getProjectPullRequests(projectId)
        ]);

        this.repository.setSettings(settings);
        this.repository.setPullRequests(pullRequestsResponse.items, pullRequestsResponse.total);
    };
}

export const LoadAutoFixUseCase = Abstraction.createImplementation({
    implementation: LoadAutoFixUseCaseImpl,
    dependencies: [AutoFixGateway, AutoFixRepository]
});
