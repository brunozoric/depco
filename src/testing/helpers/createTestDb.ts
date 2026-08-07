import { randomUUID } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { runMigrations } from "#api/db/migrate.js";

let testDbDir: string | undefined;

function getTestDbDir(): string {
    if (testDbDir === undefined) {
        testDbDir = mkdtempSync(join(tmpdir(), "dependency-upgrader-test-db-"));
        process.on("exit", () => {
            rmSync(testDbDir!, { recursive: true, force: true });
        });
    }
    return testDbDir;
}

export function createTestDb(): BetterSQLite3Database {
    const dbPath = join(getTestDbDir(), `${randomUUID()}.sqlite`);
    const sqlite = new Database(dbPath);
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite);
    runMigrations(db);
    return db;
}

export function createTestDatabaseClient(): DatabaseClient.Interface {
    const db = createTestDb();
    return { db };
}
