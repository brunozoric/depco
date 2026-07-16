import { migrate } from "drizzle-orm/libsql/migrator";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

export async function runMigrations(db: LibSQLDatabase): Promise<void> {
    await migrate(db, { migrationsFolder: "./src/api/db/migrations" });
}
