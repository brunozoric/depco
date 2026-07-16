import { createAbstraction } from "#shared/index.js";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

export interface IDatabaseClient {
    readonly db: LibSQLDatabase;
}

export const DatabaseClient = createAbstraction<IDatabaseClient>("Api/DatabaseClient");

export namespace DatabaseClient {
    export type Interface = IDatabaseClient;
}
