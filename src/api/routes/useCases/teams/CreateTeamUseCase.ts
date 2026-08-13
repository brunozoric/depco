import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams } from "#api/db/schema.js";
import { CreateTeamUseCase as Abstraction } from "./abstractions/CreateTeamUseCase.js";
import { toTeamWithStats, zeroStats, type ITeamRow } from "./teamStatsHelper.js";

class CreateTeamUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const existing = await db.select().from(teams).where(eq(teams.name, params.name)).get();
            if (existing) {
                return Result.fail({
                    code: "TEAM_NAME_CONFLICT",
                    statusCode: 409,
                    message: `A team named "${params.name}" already exists`
                });
            }

            const team: ITeamRow = {
                id: generateId(),
                name: params.name,
                color: params.color,
                createdAt: Date.now()
            };

            await db.insert(teams).values(team).run();

            return Result.ok(toTeamWithStats(team, zeroStats()));
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const CreateTeamUseCase = Abstraction.createImplementation({
    implementation: CreateTeamUseCaseImpl,
    dependencies: [DatabaseClient]
});
