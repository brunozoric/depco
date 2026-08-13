import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams, teamProjects } from "#api/db/schema.js";
import { SetTeamProjectsUseCase as Abstraction } from "./abstractions/SetTeamProjectsUseCase.js";

class SetTeamProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const team = await db.select().from(teams).where(eq(teams.id, params.id)).get();
            if (!team) {
                return Result.fail({
                    code: "TEAM_NOT_FOUND",
                    statusCode: 404,
                    message: "Team not found"
                });
            }

            const uniqueProjectIds = [...new Set(params.projectIds)];

            db.transaction(tx => {
                tx.delete(teamProjects).where(eq(teamProjects.teamId, params.id)).run();

                if (uniqueProjectIds.length > 0) {
                    tx.insert(teamProjects)
                        .values(
                            uniqueProjectIds.map(projectId => ({
                                id: generateId(),
                                teamId: params.id,
                                projectId
                            }))
                        )
                        .run();
                }
            });

            return Result.ok();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const SetTeamProjectsUseCase = Abstraction.createImplementation({
    implementation: SetTeamProjectsUseCaseImpl,
    dependencies: [DatabaseClient]
});
