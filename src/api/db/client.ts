import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { DatabaseClient } from "./abstractions/DatabaseClient.js";

export async function createDatabaseClient(dbPath: string): Promise<DatabaseClient.Interface> {
    const client = createClient({ url: "file:" + dbPath });
    await client.batch([
        "PRAGMA journal_mode = WAL",
        "PRAGMA busy_timeout = 5000",
        "PRAGMA foreign_keys = ON"
    ]);
    return { db: drizzle(client) };
}
