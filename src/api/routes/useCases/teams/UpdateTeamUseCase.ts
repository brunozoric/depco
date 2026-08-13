import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams } from "#api/db/schema.js";
import { UpdateTeamUseCase as Abstraction } from "./abstractions/UpdateTeamUseCase.js";
import {
    computeStatsByTeam,
    toTeamWithStats,
    zeroStats,
    type ITeamRow
} from "./teamStatsHelper.js";

class UpdateTeamUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const existing = await db.select().from(teams).where(eq(teams.id, params.id)).get();
            if (!existing) {
                return Result.fail({ statusCode: 404, message: "Team not found" });
            }

            if (params.name !== undefined && params.name !== existing.name) {
                const nameConflict = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.name, params.name))
                    .get();
                if (nameConflict) {
                    return Result.fail({
                        statusCode: 409,
                        message: `A team named "${params.name}" already exists`
                    });
                }
            }

            const updates = {
                name: params.name ?? existing.name,
                color: params.color ?? existing.color
            };

            await db.update(teams).set(updates).where(eq(teams.id, params.id)).run();

            const statsByTeam = await computeStatsByTeam(db);
            const updatedTeam: ITeamRow = { ...existing, ...updates };

            return Result.ok(
                toTeamWithStats(updatedTeam, statsByTeam.get(params.id) ?? zeroStats())
            );
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdateTeamUseCase = Abstraction.createImplementation({
    implementation: UpdateTeamUseCaseImpl,
    dependencies: [DatabaseClient]
});
