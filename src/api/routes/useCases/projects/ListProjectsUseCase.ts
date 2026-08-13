import { existsSync } from "fs";
import { join } from "path";
import { eq, sql, inArray } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { ListProjectsUseCase as Abstraction } from "./abstractions/ListProjectsUseCase.js";

class ListProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly securityService: SecurityService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const page = params.page ?? 1;
            const pageSize = params.pageSize ?? 50;
            const offset = (page - 1) * pageSize;

            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(projects)
                .get();
            const total = countResult?.count ?? 0;

            const pagedProjects = await db
                .select()
                .from(projects)
                .limit(pageSize)
                .offset(offset)
                .all();

            const projectIds = pagedProjects.map(p => p.id);
            const teamRows =
                projectIds.length > 0
                    ? await db
                          .select({
                              projectId: teamProjects.projectId,
                              teamId: teams.id,
                              teamName: teams.name,
                              teamColor: teams.color
                          })
                          .from(teamProjects)
                          .innerJoin(teams, eq(teamProjects.teamId, teams.id))
                          .where(inArray(teamProjects.projectId, projectIds))
                          .all()
                    : [];

            const teamsByProject = new Map<string, Abstraction.TeamBadge[]>();
            for (const row of teamRows) {
                const list = teamsByProject.get(row.projectId) ?? [];
                list.push({ id: row.teamId, name: row.teamName, color: row.teamColor });
                teamsByProject.set(row.projectId, list);
            }

            const items = await Promise.all(
                pagedProjects.map(async project => {
                    const security = await this.securityService.getLatest(project.id);
                    return {
                        ...project,
                        security,
                        hasNodeModules: existsSync(join(project.path, "node_modules")),
                        teams: teamsByProject.get(project.id) ?? []
                    };
                })
            );

            return Result.ok({ items, total });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ListProjectsUseCase = Abstraction.createImplementation({
    implementation: ListProjectsUseCaseImpl,
    dependencies: [DatabaseClient, SecurityService]
});
