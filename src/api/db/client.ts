import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DatabaseClient } from "./abstractions/DatabaseClient.js";

export function createDatabaseClient(dbPath: string): DatabaseClient.Interface {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    return { db: drizzle(sqlite) };
}
