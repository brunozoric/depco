import type { Logger } from "pino";
import { createAbstraction } from "#shared/index.js";

export interface ILoggerService {
    logger: Logger;
    initFileDestination(directory: string): Promise<void>;
    refreshLogLevels(): void;
}

export const LoggerService = createAbstraction<ILoggerService>("Api/LoggerService");

export namespace LoggerService {
    export type Interface = ILoggerService;
}
