import { join } from "node:path";
import { RunMigrationsStep as Abstraction } from "./abstractions/RunMigrationsStep.js";
import { createDatabaseClient } from "#api/db/client.js";
import { runMigrations } from "#api/db/migrate.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class RunMigrationsStepImpl implements Abstraction.Interface {
    public name = "run-migrations";
    public description = "Run database migrations";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const dbPath = join(context.dataDirectory, "manager.db");
        const databaseClient = createDatabaseClient(dbPath);
        runMigrations(databaseClient.db);
        context.results.set("dbPath", dbPath);
        return { success: true };
    }
}

export const RunMigrationsStep = Abstraction.createImplementation({
    implementation: RunMigrationsStepImpl,
    dependencies: []
});
