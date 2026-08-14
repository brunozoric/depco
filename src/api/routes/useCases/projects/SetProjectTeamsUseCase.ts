import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, teamProjects } from "#api/db/schema.js";
import { SetProjectTeamsUseCase as Abstraction } from "./abstractions/SetProjectTeamsUseCase.js";

class SetProjectTeamsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        try {
            project = await db.select().from(projects).where(eq(projects.id, params.id)).get();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }

        if (!project) {
            return Result.fail({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }

        try {
            const uniqueTeamIds = [...new Set(params.teamIds)];

            db.transaction(tx => {
                tx.delete(teamProjects).where(eq(teamProjects.projectId, params.id)).run();

                if (uniqueTeamIds.length > 0) {
                    tx.insert(teamProjects)
                        .values(
                            uniqueTeamIds.map(teamId => ({
                                id: generateId(),
                                teamId,
                                projectId: params.id
                            }))
                        )
                        .run();
                }
            });

            return Result.ok();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const SetProjectTeamsUseCase = Abstraction.createImplementation({
    implementation: SetProjectTeamsUseCaseImpl,
    dependencies: [DatabaseClient]
});
