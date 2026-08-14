import { eq } from "drizzle-orm";
import pino from "pino";
import { LoggerService as Abstraction } from "./abstractions/LoggerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appSettings } from "#api/db/schema.js";
import { createConsoleDestination } from "./destinations/createConsoleDestination.js";
import { createDatabaseDestination } from "./destinations/createDatabaseDestination.js";

class LoggerServiceImpl implements Abstraction.Interface {
    public readonly logger: pino.Logger;
    private readonly multistream: pino.MultiStreamRes;

    public constructor(
        databaseClient: DatabaseClient.Interface,
        webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {
        const logLevel = this.readLogLevel(databaseClient);

        const dbDestination = createDatabaseDestination({
            db: databaseClient.db,
            broadcaster: webSocketBroadcaster,
            threshold: logLevel
        });

        const consoleDestination = createConsoleDestination({ threshold: "info" });

        const streams: pino.StreamEntry[] = [
            consoleDestination,
            { stream: dbDestination, level: logLevel as pino.Level }
        ];

        this.multistream = pino.multistream(streams);
        this.logger = pino(
            { level: "trace", timestamp: pino.stdTimeFunctions.epochTime },
            this.multistream
        );
    }

    public async initFileDestination(directory: string): Promise<void> {
        const { createFileDestination } = await import("./destinations/createFileDestination.js");
        const fileEntry = await createFileDestination({ directory, threshold: "debug" });
        this.multistream.add(fileEntry);
    }

    private readLogLevel(databaseClient: DatabaseClient.Interface): string {
        const row = databaseClient.db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, "log_level"))
            .get();

        return row?.value ?? "warn";
    }
}

export const LoggerService = Abstraction.createImplementation({
    implementation: LoggerServiceImpl,
    dependencies: [DatabaseClient, WebSocketBroadcaster]
});
