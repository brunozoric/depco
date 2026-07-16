import { DeleteAppLogsUseCase as Abstraction } from "./abstractions/DeleteAppLogsUseCase.js";
import { AppLogsGateway } from "../../../features/appLogs/abstractions/AppLogsGateway.js";

class DeleteAppLogsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: AppLogsGateway.Interface) {}

    public execute = async (filters: AppLogsGateway.Filters): Promise<number> => {
        return this.gateway.deleteFiltered(filters);
    };
}

export const DeleteAppLogsUseCase = Abstraction.createImplementation({
    implementation: DeleteAppLogsUseCaseImpl,
    dependencies: [AppLogsGateway]
});
