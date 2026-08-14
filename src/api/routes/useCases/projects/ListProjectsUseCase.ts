import { existsSync } from "fs";
import { join } from "path";
import { eq, sql, inArray, like, or, asc, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "#api/services/Security/index.js";
import { projects, teams, teamProjects } from "#api/db/schema.js";
import { ListProjectsUseCase as Abstraction } from "./abstractions/ListProjectsUseCase.js";

const ENGINE_STATUS_PRIORITY = sql`CASE ${projects.engineStatus}
    WHEN 'eol' THEN 0
    WHEN 'maintenance' THEN 1
    WHEN 'unknown' THEN 2
    WHEN 'active-lts' THEN 3
    WHEN 'current' THEN 4
    ELSE 5
END`;

function buildOrderBy(sortBy: string | undefined, sortOrder: string | undefined): SQL[] {
    const direction = sortOrder === "desc" ? desc : asc;

    switch (sortBy) {
        case "addedAt":
            return [direction(projects.addedAt)];
        case "lastScannedAt":
            return [
                asc(sql`CASE WHEN ${projects.lastScannedAt} IS NULL THEN 1 ELSE 0 END`),
                direction(projects.lastScannedAt)
            ];
        case "engineStatus":
            return [
                sortOrder === "desc" ? desc(ENGINE_STATUS_PRIORITY) : asc(ENGINE_STATUS_PRIORITY)
            ];
        case "name":
        default:
            return [direction(projects.name)];
    }
}

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

            const conditions: SQL[] = [];

            if (params.search) {
                const pattern = `%${params.search}%`;
                conditions.push(or(like(projects.name, pattern), like(projects.path, pattern))!);
            }

            let filteredProjectIds: string[] | null = null;
            if (params.teamId) {
                const teamProjectRows = await db
                    .select({ projectId: teamProjects.projectId })
                    .from(teamProjects)
                    .where(eq(teamProjects.teamId, params.teamId))
                    .all();
                filteredProjectIds = teamProjectRows.map(row => row.projectId);
                if (filteredProjectIds.length === 0) {
                    return Result.ok({ items: [], total: 0 });
                }
                conditions.push(inArray(projects.id, filteredProjectIds));
            }

            if (params.engineStatus) {
                const statuses = params.engineStatus.split(",").map(s => s.trim());
                conditions.push(inArray(projects.engineStatus, statuses));
            }

            const whereClause =
                conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

            const countQuery = db.select({ count: sql<number>`count(*)` }).from(projects);
            if (whereClause) {
                countQuery.where(whereClause);
            }
            const countResult = await countQuery.get();
            const total = countResult?.count ?? 0;

            const listQuery = db.select().from(projects);
            if (whereClause) {
                listQuery.where(whereClause);
            }
            const orderClauses = buildOrderBy(params.sortBy, params.sortOrder);
            const pagedProjects = await listQuery
                .orderBy(...orderClauses)
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
                        teams: teamsByProject.get(project.id) ?? [],
                        engineStatus: project.engineStatus ?? null,
                        rootEnginesNode: project.rootEnginesNode ?? null
                    };
                })
            );

            return Result.ok({ items, total });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListProjectsUseCase = Abstraction.createImplementation({
    implementation: ListProjectsUseCaseImpl,
    dependencies: [DatabaseClient, SecurityService]
});
