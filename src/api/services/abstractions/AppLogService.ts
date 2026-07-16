import { createAbstraction } from "#shared/index.js";

export type LogLevel = "error" | "warn" | "info";

export interface IAppLogService {
    log(
        level: LogLevel,
        source: string,
        projectId: string | null,
        message: string,
        details?: string
    ): Promise<void>;
}

export const AppLogService = createAbstraction<IAppLogService>("Api/AppLogService");

export namespace AppLogService {
    export type Interface = IAppLogService;
    export type Level = LogLevel;
}
