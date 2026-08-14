import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { dependencyChanges, projects } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardDependencyChangesUseCase as Abstraction } from "./abstractions/GetDashboardDependencyChangesUseCase.js";

interface ICountRow {
    count: number;
}

class GetDashboardDependencyChangesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { projectId, limit, teamId } = params;

            const conditions: SQL[] = [];
            if (projectId) {
                conditions.push(eq(dependencyChanges.projectId, projectId));
            }
            if (teamId) {
                conditions.push(sql`${dependencyChanges.projectId} IN ${teamProjectIds(teamId)}`);
            }
            const where = conditions.length > 0 ? and(...conditions) : undefined;

            const [items, countResult] = await Promise.all([
                db
                    .select({
                        id: dependencyChanges.id,
                        projectId: dependencyChanges.projectId,
                        projectName: projects.name,
                        packageName: dependencyChanges.packageName,
                        changeType: dependencyChanges.changeType,
                        previousVersion: dependencyChanges.previousVersion,
                        newVersion: dependencyChanges.newVersion,
                        detectedAt: dependencyChanges.detectedAt
                    })
                    .from(dependencyChanges)
                    .innerJoin(projects, eq(dependencyChanges.projectId, projects.id))
                    .where(where)
                    .orderBy(sql`${dependencyChanges.detectedAt} DESC`)
                    .limit(limit)
                    .all(),
                db
                    .select({ count: sql<number>`COUNT(*)` })
                    .from(dependencyChanges)
                    .where(where)
                    .get() as ICountRow | undefined
            ]);

            const mappedItems: Abstraction.Item[] = items.map(item => ({
                ...item,
                changeType: item.changeType as "added" | "removed" | "version-changed"
            }));

            return Result.ok({ items: mappedItems, total: countResult?.count ?? 0 });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetDashboardDependencyChangesUseCase = Abstraction.createImplementation({
    implementation: GetDashboardDependencyChangesUseCaseImpl,
    dependencies: [DatabaseClient]
});
