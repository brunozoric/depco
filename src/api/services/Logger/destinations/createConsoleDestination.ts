import type { Level, StreamEntry } from "pino";
import pinoPretty from "pino-pretty";

interface IConsoleDestinationOptions {
    threshold?: string;
}

export function createConsoleDestination(options?: IConsoleDestinationOptions): StreamEntry {
    const stream = pinoPretty({
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname"
    });

    const level = (options?.threshold ?? "info") as Level;

    return { stream, level };
}
