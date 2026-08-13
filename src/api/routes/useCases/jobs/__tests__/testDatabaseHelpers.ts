import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export interface IClosableSqliteClient {
    close(): void;
}

export interface IDatabaseWithSqliteClient {
    $client: IClosableSqliteClient;
}

/**
 * Forces every subsequent query against `db` to throw, by closing the
 * underlying SQLite connection. Used to exercise the "unexpected error"
 * branches of use cases that talk to a real (non-mocked) DatabaseClient.
 */
export function closeDatabaseConnection(db: BetterSQLite3Database): void {
    (db as unknown as IDatabaseWithSqliteClient).$client.close();
}
