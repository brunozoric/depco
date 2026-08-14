import { asc, eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { PackageJsonService } from "#api/services/PackageJson/index.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { ListStepHooksUseCase as Abstraction } from "./abstractions/ListStepHooksUseCase.js";
import { toStepHookResponse } from "./stepHookHelper.js";

class ListStepHooksUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly fileConfigService: FileConfigService.Interface,
        private readonly packageJsonService: PackageJsonService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const project = await db
                .select({ path: projects.path })
                .from(projects)
                .where(eq(projects.id, params.projectId))
                .get();

            if (!project) {
                return Result.fail({
                    code: "PROJECT_NOT_FOUND",
                    statusCode: 404,
                    message: "Project not found"
                });
            }

            const fileConfig = await this.fileConfigService.readConfig(project.path);
            const allScripts = await this.packageJsonService.getScripts(project.path);

            if (fileConfig?.stepHooks) {
                const stepHooks = fileConfig.stepHooks;
                const now = Date.now();
                const items = stepHooks.map((hook, index) => ({
                    id: `file-${index}`,
                    projectId: params.projectId,
                    position: hook.position,
                    name: hook.name,
                    command: hook.command,
                    type: hook.executionType,
                    required: hook.required,
                    enabled: true,
                    sortOrder: index,
                    source: "file" as const,
                    createdAt: now,
                    updatedAt: now
                }));

                const configuredNames = new Set(stepHooks.map(hook => hook.name));
                const discoveredScripts = allScripts.filter(
                    script => !configuredNames.has(script.name)
                );

                return Result.ok({ items, configSource: "file", discoveredScripts });
            }

            const rows = await db
                .select()
                .from(projectStepHooks)
                .where(eq(projectStepHooks.projectId, params.projectId))
                .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
                .all();

            const configuredNames = new Set(rows.map(row => row.name));
            const discoveredScripts = allScripts.filter(
                script => !configuredNames.has(script.name)
            );

            return Result.ok({
                items: rows.map(toStepHookResponse),
                configSource: "db",
                discoveredScripts
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListStepHooksUseCase = Abstraction.createImplementation({
    implementation: ListStepHooksUseCaseImpl,
    dependencies: [DatabaseClient, FileConfigService, PackageJsonService]
});
