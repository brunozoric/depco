import { Writable } from "node:stream";
import { generateId } from "@webiny/stdlib";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appLogs } from "#api/db/schema.js";

const PINO_LEVEL_TO_STRING: Record<number, string> = {
    10: "trace",
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal"
};

export const LEVEL_PRIORITY: Record<string, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
};

interface IDatabaseDestinationOptions {
    db: BetterSQLite3Database;
    broadcaster: WebSocketBroadcaster.Interface;
    threshold: string;
}

export interface IDatabaseDestinationState {
    thresholdPriority: number;
}

export interface IDatabaseDestinationResult {
    writable: Writable;
    state: IDatabaseDestinationState;
}

export function createDatabaseDestination(
    options: IDatabaseDestinationOptions
): IDatabaseDestinationResult {
    const { db, broadcaster, threshold } = options;
    const state: IDatabaseDestinationState = {
        thresholdPriority: LEVEL_PRIORITY[threshold] ?? 3
    };

    const writable = new Writable({
        write(chunk: Buffer, _encoding, callback) {
            try {
                const line = chunk.toString().trim();
                if (!line) {
                    callback();
                    return;
                }

                const entry = JSON.parse(line);
                const levelString = PINO_LEVEL_TO_STRING[entry.level] ?? "info";
                const entryPriority = LEVEL_PRIORITY[levelString] ?? 2;
                const source = entry.source ?? "app";

                if (source === "http" && entryPriority < LEVEL_PRIORITY["warn"]!) {
                    callback();
                    return;
                }

                if (entryPriority < state.thresholdPriority) {
                    callback();
                    return;
                }

                const id = generateId();
                const createdAt = entry.time ?? Date.now();

                db.insert(appLogs)
                    .values({
                        id,
                        level: levelString,
                        source,
                        projectId: entry.projectId ?? null,
                        message: entry.msg ?? "",
                        details: entry.details ?? null,
                        createdAt
                    })
                    .run();

                broadcaster.broadcast("log:created", {
                    id,
                    level: levelString,
                    source,
                    projectId: entry.projectId ?? null,
                    message: entry.msg ?? "",
                    createdAt
                });

                callback();
            } catch (error) {
                process.stderr.write(
                    `[pino-db-destination] Failed to persist log: ${error instanceof Error ? error.message : String(error)}\n`
                );
                callback();
            }
        }
    });

    return { writable, state };
}
