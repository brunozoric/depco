import { eq, and, sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanResults } from "#api/db/schema.js";
import { GetTransitiveResolveStatusUseCase as Abstraction } from "./abstractions/GetTransitiveResolveStatusUseCase.js";

interface ITransitiveCountRow {
    total: number;
    resolved: number;
}

class GetTransitiveResolveStatusUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        try {
            project = await db.select().from(projects).where(eq(projects.id, params.id)).get();
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }

        if (!project) {
            return Result.fail({ statusCode: 404, message: "Project not found" });
        }

        try {
            const countRow = (await db
                .select({
                    total: sql<number>`COUNT(*)`,
                    resolved: sql<number>`SUM(CASE WHEN ${scanResults.registryResolved} = 1 THEN 1 ELSE 0 END)`
                })
                .from(scanResults)
                .where(
                    and(
                        eq(scanResults.projectId, project.id),
                        eq(scanResults.dependencyKind, "transitive")
                    )
                )
                .get()) as ITransitiveCountRow | undefined;

            const total = countRow?.total ?? 0;
            const resolved = countRow?.resolved ?? 0;

            return Result.ok({ total, resolved, pending: total - resolved });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetTransitiveResolveStatusUseCase = Abstraction.createImplementation({
    implementation: GetTransitiveResolveStatusUseCaseImpl,
    dependencies: [DatabaseClient]
});
