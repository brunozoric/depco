import { eq, and, asc } from "drizzle-orm";
import { StepHookService as Abstraction } from "./abstractions/StepHookService.js";
import type { IResolvedStepHook } from "./abstractions/StepHookService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "../FileConfig/index.js";
import { projectStepHooks } from "#api/db/schema.js";

class StepHookServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async getStepConfig(
        projectId: string,
        projectPath: string
    ): Promise<IResolvedStepHook[]> {
        const fileConfig = await this.fileConfigService.readConfig(projectPath);

        if (fileConfig?.stepHooks) {
            return fileConfig.stepHooks.map(hook => ({
                position: hook.position,
                name: hook.name,
                command: hook.command,
                executionType: hook.executionType,
                required: hook.required,
                source: "file" as const
            }));
        }

        const rows = await this.databaseClient.db
            .select()
            .from(projectStepHooks)
            .where(and(eq(projectStepHooks.projectId, projectId), eq(projectStepHooks.enabled, 1)))
            .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
            .all();

        return rows.map(row => ({
            position: row.position,
            name: row.name,
            command: row.command,
            executionType: row.type as IResolvedStepHook["executionType"],
            required: row.required === 1,
            source: row.source as IResolvedStepHook["source"]
        }));
    }
}

export const StepHookService = Abstraction.createImplementation({
    implementation: StepHookServiceImpl,
    dependencies: [DatabaseClient, FileConfigService]
});
