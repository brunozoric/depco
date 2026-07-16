import { randomUUID } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
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

export async function createTestDb(): Promise<LibSQLDatabase> {
    const dbPath = join(getTestDbDir(), `${randomUUID()}.sqlite`);
    const client = createClient({ url: `file:${dbPath}` });
    await client.execute("PRAGMA foreign_keys = ON");
    const db = drizzle(client);
    await runMigrations(db);
    return db;
}

export async function createTestDatabaseClient(): Promise<DatabaseClient.Interface> {
    const db = await createTestDb();
    return { db };
}
