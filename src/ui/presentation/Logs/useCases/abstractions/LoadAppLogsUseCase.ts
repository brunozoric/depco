import { createAbstraction } from "#shared/index.js";
import type { IAppLogsFilters } from "../../../../features/AppLogs/abstractions/AppLogsGateway.js";

export interface ILoadAppLogsUseCase {
    execute(filters: IAppLogsFilters, limit?: number, offset?: number): Promise<void>;
}

export const LoadAppLogsUseCase = createAbstraction<ILoadAppLogsUseCase>("Ui/LoadAppLogsUseCase");

export namespace LoadAppLogsUseCase {
    export type Interface = ILoadAppLogsUseCase;
}
