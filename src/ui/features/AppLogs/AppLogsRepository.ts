import { AppLogsRepository as Abstraction } from "./abstractions/AppLogsRepository.js";

class AppLogsRepositoryImpl implements Abstraction.Interface {
    private logs: Abstraction.LogEntry[] = [];
    private total = 0;

    public getLogs(): Abstraction.LogEntry[] {
        return this.logs;
    }

    public setLogs(logs: Abstraction.LogEntry[]): void {
        this.logs = logs;
    }

    public getTotal(): number {
        return this.total;
    }

    public setTotal(total: number): void {
        this.total = total;
    }

    public prependLog(log: Abstraction.LogEntry): void {
        this.logs = [log, ...this.logs];
        this.total++;
    }
}

export const AppLogsRepository = Abstraction.createImplementation({
    implementation: AppLogsRepositoryImpl,
    dependencies: []
});
