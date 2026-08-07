import { createAbstraction } from "#shared/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export interface IDatabaseClient {
    readonly db: BetterSQLite3Database;
}

export const DatabaseClient = createAbstraction<IDatabaseClient>("Api/DatabaseClient");

export namespace DatabaseClient {
    export type Interface = IDatabaseClient;
}
