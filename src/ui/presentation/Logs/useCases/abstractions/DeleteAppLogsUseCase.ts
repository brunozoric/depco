import { createAbstraction } from "#shared/index.js";
import type { IAppLogsFilters } from "../../../../features/AppLogs/abstractions/AppLogsGateway.js";

export interface IDeleteAppLogsUseCase {
    execute(filters: IAppLogsFilters): Promise<number>;
}

export const DeleteAppLogsUseCase =
    createAbstraction<IDeleteAppLogsUseCase>("Ui/DeleteAppLogsUseCase");

export namespace DeleteAppLogsUseCase {
    export type Interface = IDeleteAppLogsUseCase;
}
