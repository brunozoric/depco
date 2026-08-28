import { eq } from "drizzle-orm";
import pino from "pino";
import { LoggerService as Abstraction } from "./abstractions/LoggerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appSettings } from "#api/db/schema.js";
import { createConsoleDestination } from "./destinations/createConsoleDestination.js";
import { createDatabaseDestination } from "./destinations/createDatabaseDestination.js";

const VALID_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);

interface IDestinationLevels {
    console: string;
    file: string;
    database: string;
}

class LoggerServiceImpl implements Abstraction.Interface {
    public readonly logger: pino.Logger;
    private readonly multistream: pino.MultiStreamRes;
    private readonly databaseClient: DatabaseClient.Interface;

    public constructor(
        databaseClient: DatabaseClient.Interface,
        webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {
        this.databaseClient = databaseClient;
        const levels = this.readDestinationLevels();

        const dbDestination = createDatabaseDestination({
            db: databaseClient.db,
            broadcaster: webSocketBroadcaster,
            threshold: levels.database
        });

        const consoleDestination = createConsoleDestination({ threshold: levels.console });

        const streams: pino.StreamEntry[] = [
            consoleDestination,
            { stream: dbDestination, level: levels.database as pino.Level }
        ];

        this.multistream = pino.multistream(streams);
        this.logger = pino(
            { level: "trace", timestamp: pino.stdTimeFunctions.epochTime },
            this.multistream
        );
    }

    public async initFileDestination(directory: string): Promise<void> {
        const { createFileDestination } = await import("./destinations/createFileDestination.js");
        const fileLevel = this.readSingleLevel("file_log_level", "debug");
        const fileEntry = await createFileDestination({ directory, threshold: fileLevel });
        this.multistream.add(fileEntry);
    }

    private readDestinationLevels(): IDestinationLevels {
        return {
            console: this.readSingleLevel("console_log_level", "info"),
            file: this.readSingleLevel("file_log_level", "debug"),
            database: this.readSingleLevel("log_level", "warn")
        };
    }

    private readSingleLevel(key: string, fallback: string): string {
        const row = this.databaseClient.db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, key))
            .get();

        const level = row?.value ?? fallback;
        return VALID_LEVELS.has(level) ? level : fallback;
    }
}

export const LoggerService = Abstraction.createImplementation({
    implementation: LoggerServiceImpl,
    dependencies: [DatabaseClient, WebSocketBroadcaster]
});
