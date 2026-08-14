import { eq, and, like, sql, type SQL } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, scanResults } from "#api/db/schema.js";
import { GetProjectDependenciesUseCase as Abstraction } from "./abstractions/GetProjectDependenciesUseCase.js";

class GetProjectDependenciesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { db } = this.databaseClient;

        let project;
        try {
            project = await db.select().from(projects).where(eq(projects.id, params.id)).get();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }

        if (!project) {
            return Result.fail({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }

        try {
            const pageSize = params.pageSize ?? 25;
            const page = params.page ?? 1;
            const offset = (page - 1) * pageSize;

            const conditions: SQL[] = [eq(scanResults.projectId, project.id)];
            if (params.dependencyKind && params.dependencyKind !== "all") {
                conditions.push(eq(scanResults.dependencyKind, params.dependencyKind));
            }
            if (params.registryResolved && params.registryResolved !== "all") {
                conditions.push(
                    eq(scanResults.registryResolved, params.registryResolved === "true" ? 1 : 0)
                );
            }
            if (params.search) {
                conditions.push(like(scanResults.name, `%${params.search}%`));
            }

            const where = and(...conditions);

            const countRow = db
                .select({ count: sql<number>`COUNT(*)` })
                .from(scanResults)
                .where(where)
                .get();
            const total = countRow?.count ?? 0;

            const rows = db
                .select()
                .from(scanResults)
                .where(where)
                .orderBy(scanResults.name)
                .limit(pageSize)
                .offset(offset)
                .all();

            const items = rows.map(row => ({
                name: row.name,
                currentVersion: row.currentVersion,
                latestVersion: row.latestVersion,
                latestInRange: row.latestInRange,
                type: row.type,
                upgradeType: row.upgradeType,
                dependencyKind: row.dependencyKind,
                registryResolved: row.registryResolved === 1
            }));

            return Result.ok({ items, total });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetProjectDependenciesUseCase = Abstraction.createImplementation({
    implementation: GetProjectDependenciesUseCaseImpl,
    dependencies: [DatabaseClient]
});
