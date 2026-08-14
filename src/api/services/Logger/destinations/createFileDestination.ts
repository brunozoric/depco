import type { Level, StreamEntry } from "pino";
import buildRollingStream from "pino-roll";

interface IFileDestinationOptions {
    directory: string;
    threshold?: string;
}

export async function createFileDestination(
    options: IFileDestinationOptions
): Promise<StreamEntry> {
    const stream = await buildRollingStream({
        file: `${options.directory}/app.log`,
        frequency: "daily",
        limit: { count: 7 },
        size: "10m"
    });

    const level = (options.threshold ?? "debug") as Level;

    return { stream, level };
}
