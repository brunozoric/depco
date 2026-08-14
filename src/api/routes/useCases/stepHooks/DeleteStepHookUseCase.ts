import { and, eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projectStepHooks } from "#api/db/schema.js";
import { DeleteStepHookUseCase as Abstraction } from "./abstractions/DeleteStepHookUseCase.js";

class DeleteStepHookUseCaseImpl implements Abstraction.Interface {
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
                return Result.fail({
                    code: "STEP_HOOK_NOT_FOUND",
                    statusCode: 404,
                    message: "Step hook not found"
                });
            }

            await db.delete(projectStepHooks).where(eq(projectStepHooks.id, params.hookId)).run();

            return Result.ok({ deleted: true });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const DeleteStepHookUseCase = Abstraction.createImplementation({
    implementation: DeleteStepHookUseCaseImpl,
    dependencies: [DatabaseClient]
});
