import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams } from "#api/db/schema.js";
import { DeleteTeamUseCase as Abstraction } from "./abstractions/DeleteTeamUseCase.js";

class DeleteTeamUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const existing = await db.select().from(teams).where(eq(teams.id, params.id)).get();
            if (!existing) {
                return Result.fail({ statusCode: 404, message: "Team not found" });
            }

            await db.delete(teams).where(eq(teams.id, params.id)).run();

            return Result.ok();
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const DeleteTeamUseCase = Abstraction.createImplementation({
    implementation: DeleteTeamUseCaseImpl,
    dependencies: [DatabaseClient]
});
