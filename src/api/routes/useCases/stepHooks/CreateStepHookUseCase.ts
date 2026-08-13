import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projectStepHooks } from "#api/db/schema.js";
import { CreateStepHookUseCase as Abstraction } from "./abstractions/CreateStepHookUseCase.js";
import { toStepHookResponse } from "./stepHookHelper.js";

class CreateStepHookUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const now = Date.now();

            const row = {
                id: generateId(),
                projectId: params.projectId,
                position: params.position,
                name: params.name,
                command: params.command,
                type: params.type,
                required: params.required ? 1 : 0,
                enabled: 1,
                sortOrder: 0,
                source: "db" as const,
                createdAt: now,
                updatedAt: now
            };

            await db.insert(projectStepHooks).values(row).run();

            return Result.ok(toStepHookResponse(row));
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const CreateStepHookUseCase = Abstraction.createImplementation({
    implementation: CreateStepHookUseCaseImpl,
    dependencies: [DatabaseClient]
});
