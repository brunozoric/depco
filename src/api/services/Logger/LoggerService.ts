import { eq } from "drizzle-orm";
import pino from "pino";
import { LoggerService as Abstraction } from "./abstractions/LoggerService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appSettings } from "#api/db/schema.js";
import { createConsoleDestination } from "./destinations/createConsoleDestination.js";
import {
    createDatabaseDestination,
    LEVEL_PRIORITY,
    type IDatabaseDestinationState
} from "./destinations/createDatabaseDestination.js";

const VALID_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);

interface IDestinationLevels {
    console: string;
    file: string;
    database: string;
}

/** Stream indices within the multistream. */
const CONSOLE_STREAM_INDEX = 0;
const DATABASE_STREAM_INDEX = 1;
const FILE_STREAM_INDEX = 2;

class LoggerServiceImpl implements Abstraction.Interface {
    public readonly logger: pino.Logger;
    private readonly multistream: pino.MultiStreamRes;
    private readonly databaseClient: DatabaseClient.Interface;
    private readonly dbDestinationState: IDatabaseDestinationState;

    public constructor(
        databaseClient: DatabaseClient.Interface,
        webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {
        this.databaseClient = databaseClient;
        const levels = this.readDestinationLevels();

        const { writable: dbDestination, state: dbState } = createDatabaseDestination({
            db: databaseClient.db,
            broadcaster: webSocketBroadcaster,
            threshold: levels.database
        });
        this.dbDestinationState = dbState;

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

    public refreshLogLevels(): void {
        const levels = this.readDestinationLevels();
        const streams = this.multistream.streams;

        if (streams[CONSOLE_STREAM_INDEX]) {
            streams[CONSOLE_STREAM_INDEX].level = levels.console as pino.Level;
        }

        if (streams[DATABASE_STREAM_INDEX]) {
            streams[DATABASE_STREAM_INDEX].level = levels.database as pino.Level;
            this.dbDestinationState.thresholdPriority = LEVEL_PRIORITY[levels.database] ?? 3;
        }

        if (streams[FILE_STREAM_INDEX]) {
            streams[FILE_STREAM_INDEX].level = levels.file as pino.Level;
        }
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
