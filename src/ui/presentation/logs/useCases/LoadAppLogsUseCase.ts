import { LoadAppLogsUseCase as Abstraction } from "./abstractions/LoadAppLogsUseCase.js";
import { AppLogsGateway } from "../../../features/appLogs/abstractions/AppLogsGateway.js";
import { AppLogsRepository } from "../../../features/appLogs/abstractions/AppLogsRepository.js";

class LoadAppLogsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: AppLogsGateway.Interface,
        private readonly repository: AppLogsRepository.Interface
    ) {}

    public execute = async (
        filters: AppLogsGateway.Filters,
        limit?: number,
        offset?: number
    ): Promise<void> => {
        const response = await this.gateway.list(filters, limit, offset);
        this.repository.setLogs(response.items);
        this.repository.setTotal(response.total);
    };
}

export const LoadAppLogsUseCase = Abstraction.createImplementation({
    implementation: LoadAppLogsUseCaseImpl,
    dependencies: [AppLogsGateway, AppLogsRepository]
});
