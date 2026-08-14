import { AppLogService as Abstraction } from "./abstractions/AppLogService.js";
import { LoggerService } from "../Logger/index.js";

class AppLogServiceImpl implements Abstraction.Interface {
    public constructor(private readonly loggerService: LoggerService.Interface) {}

    public async log(
        level: Abstraction.Level,
        source: string,
        projectId: string | null,
        message: string,
        details?: string
    ): Promise<void> {
        this.loggerService.logger[level]({ source, projectId, details: details ?? null }, message);
    }
}

export const AppLogService = Abstraction.createImplementation({
    implementation: AppLogServiceImpl,
    dependencies: [LoggerService]
});
