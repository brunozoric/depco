import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams, teamProjects, projects } from "#api/db/schema.js";
import { GetTeamUseCase as Abstraction } from "./abstractions/GetTeamUseCase.js";

class GetTeamUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
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

            const projectRows = await db
                .select({ id: projects.id, name: projects.name, path: projects.path })
                .from(teamProjects)
                .innerJoin(projects, eq(teamProjects.projectId, projects.id))
                .where(eq(teamProjects.teamId, params.id))
                .all();

            return Result.ok({
                ...team,
                projects: projectRows.map(row => ({ id: row.id, name: row.name, path: row.path }))
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetTeamUseCase = Abstraction.createImplementation({
    implementation: GetTeamUseCaseImpl,
    dependencies: [DatabaseClient]
});
