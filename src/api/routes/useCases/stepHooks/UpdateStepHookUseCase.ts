import { and, eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projectStepHooks } from "#api/db/schema.js";
import { UpdateStepHookUseCase as Abstraction } from "./abstractions/UpdateStepHookUseCase.js";
import { toStepHookResponse } from "./stepHookHelper.js";

class UpdateStepHookUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const existing = await db
                .select()
                .from(projectStepHooks)
                .where(
                    and(
                        eq(projectStepHooks.id, params.hookId),
                        eq(projectStepHooks.projectId, params.projectId)
                    )
                )
                .get();

            if (!existing) {
                return Result.fail({ statusCode: 404, message: "Step hook not found" });
            }

            const merged: typeof projectStepHooks.$inferSelect = {
                ...existing,
                name: params.name ?? existing.name,
                command: params.command ?? existing.command,
                type: params.type ?? existing.type,
                required:
                    params.required !== undefined ? (params.required ? 1 : 0) : existing.required,
                enabled: params.enabled !== undefined ? (params.enabled ? 1 : 0) : existing.enabled,
                sortOrder: params.sortOrder ?? existing.sortOrder,
                updatedAt: Date.now()
            };

            await db
                .update(projectStepHooks)
                .set(merged)
                .where(eq(projectStepHooks.id, params.hookId))
                .run();

            return Result.ok(toStepHookResponse(merged));
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdateStepHookUseCase = Abstraction.createImplementation({
    implementation: UpdateStepHookUseCaseImpl,
    dependencies: [DatabaseClient]
});
