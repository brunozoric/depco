import { createAbstraction } from "#shared/index.js";
import { AppLogsGateway } from "./AppLogsGateway.js";

export interface IAppLogsRepository {
    getLogs(): AppLogsGateway.LogEntry[];
    setLogs(logs: AppLogsGateway.LogEntry[]): void;
    getTotal(): number;
    setTotal(total: number): void;
    prependLog(log: AppLogsGateway.LogEntry): void;
}

export const AppLogsRepository = createAbstraction<IAppLogsRepository>("Ui/AppLogsRepository");

export namespace AppLogsRepository {
    export type Interface = IAppLogsRepository;
    export type LogEntry = AppLogsGateway.LogEntry;
}
