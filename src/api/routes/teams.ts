import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, sql } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import {
    listTeamsRoute,
    createTeamRoute,
    updateTeamRoute,
    deleteTeamRoute,
    getTeamDetailRoute,
    setTeamProjectsRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teams, teamProjects, projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface ITeamRow {
    id: string;
    name: string;
    color: string;
    createdAt: number;
}

interface ITeamStats {
    projectCount: number;
    vulnerabilityCount: number;
    compliantPercent: number;
    averageHealthScore: number;
}

interface ITeamWithStats extends ITeamRow, ITeamStats {}

interface IProjectCountRow {
    teamId: string;
    projectCount: number;
}

interface IVulnerabilityCountRow {
    teamId: string;
    vulnerabilityCount: number;
}

interface ILicenseComplianceRow {
    teamId: string;
    projectId: string;
    compliantCount: number;
    totalPackages: number;
}

interface IHealthScoreRow {
    teamId: string;
    projectId: string;
    score: number;
}

interface ITeamProjectRow {
    id: string;
    name: string;
    path: string;
}

function zeroStats(): ITeamStats {
    return { projectCount: 0, vulnerabilityCount: 0, compliantPercent: 100, averageHealthScore: 0 };
}

/**
 * Computes aggregate stats (project count, active vulnerability count,
 * average license compliance, average health score) for every team in one
 * batch of queries, keyed by team id. Teams with no assigned projects are
 * simply absent from every map and fall back to `zeroStats()`.
 */
async function computeStatsByTeam(
    db: DatabaseClient.Interface["db"]
): Promise<Map<string, ITeamStats>> {
    const now = Date.now();

    const projectCountRows = await db.all<IProjectCountRow>(sql`
        SELECT team_id AS teamId, COUNT(*) AS projectCount
        FROM team_projects
        GROUP BY team_id
    `);

    const vulnerabilityCountRows = await db.all<IVulnerabilityCountRow>(sql`
        SELECT tp.team_id AS teamId, COUNT(v.id) AS vulnerabilityCount
        FROM team_projects tp
        INNER JOIN vulnerabilities v ON v.project_id = tp.project_id
            AND (
                v.dismissed_at IS NULL
                OR (v.dismissed_until IS NOT NULL AND v.dismissed_until <= ${now})
            )
        GROUP BY tp.team_id
    `);

    const licenseComplianceRows = await db.all<ILicenseComplianceRow>(sql`
        SELECT tp.team_id AS teamId, ls.project_id AS projectId,
            ls.compliant_count AS compliantCount, ls.total_packages AS totalPackages
        FROM team_projects tp
        INNER JOIN license_snapshots ls ON ls.project_id = tp.project_id
            AND ls.date = (
                SELECT MAX(ls2.date) FROM license_snapshots ls2
                WHERE ls2.project_id = tp.project_id
            )
    `);

    const healthScoreRows = await db.all<IHealthScoreRow>(sql`
        SELECT tp.team_id AS teamId, hs.project_id AS projectId, hs.score
        FROM team_projects tp
        INNER JOIN health_snapshots hs ON hs.project_id = tp.project_id
            AND hs.date = (
                SELECT MAX(hs2.date) FROM health_snapshots hs2
                WHERE hs2.project_id = tp.project_id
            )
    `);

    const projectCountByTeam = new Map(projectCountRows.map(row => [row.teamId, row.projectCount]));
    const vulnerabilityCountByTeam = new Map(
        vulnerabilityCountRows.map(row => [row.teamId, row.vulnerabilityCount])
    );

    const compliancePercentsByTeam = new Map<string, number[]>();
    for (const row of licenseComplianceRows) {
        const percent =
            row.totalPackages > 0 ? (row.compliantCount / row.totalPackages) * 100 : 100;
        const percents = compliancePercentsByTeam.get(row.teamId) ?? [];
        percents.push(percent);
        compliancePercentsByTeam.set(row.teamId, percents);
    }

    const healthScoresByTeam = new Map<string, number[]>();
    for (const row of healthScoreRows) {
        const scores = healthScoresByTeam.get(row.teamId) ?? [];
        scores.push(row.score);
        healthScoresByTeam.set(row.teamId, scores);
    }

    const teamIds = new Set<string>([
        ...projectCountByTeam.keys(),
        ...vulnerabilityCountByTeam.keys(),
        ...compliancePercentsByTeam.keys(),
        ...healthScoresByTeam.keys()
    ]);

    const statsByTeam = new Map<string, ITeamStats>();
    for (const teamId of teamIds) {
        const compliancePercents = compliancePercentsByTeam.get(teamId) ?? [];
        const healthScores = healthScoresByTeam.get(teamId) ?? [];

        statsByTeam.set(teamId, {
            projectCount: projectCountByTeam.get(teamId) ?? 0,
            vulnerabilityCount: vulnerabilityCountByTeam.get(teamId) ?? 0,
            compliantPercent:
                compliancePercents.length > 0
                    ? Math.round(
                          compliancePercents.reduce((sum, value) => sum + value, 0) /
                              compliancePercents.length
                      )
                    : 100,
            averageHealthScore:
                healthScores.length > 0
                    ? Math.round(
                          healthScores.reduce((sum, value) => sum + value, 0) / healthScores.length
                      )
                    : 0
        });
    }

    return statsByTeam;
}

function toTeamWithStats(team: ITeamRow, stats: ITeamStats): ITeamWithStats {
    return { ...team, ...stats };
}

export async function teamsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listTeamsRoute, {}, async (_request, reply) => {
        const allTeams = await db.select().from(teams).all();
        const statsByTeam = await computeStatsByTeam(db);

        const items = allTeams.map(team =>
            toTeamWithStats(team, statsByTeam.get(team.id) ?? zeroStats())
        );

        sendList(reply, items, items.length);
    });

    registerRoute(app, createTeamRoute, {}, async (request, reply) => {
        const { name, color } = request.body;

        const existing = await db.select().from(teams).where(eq(teams.name, name)).get();
        if (existing) {
            sendError(reply, 409, `A team named "${name}" already exists`);
            return;
        }

        const team: ITeamRow = {
            id: generateId(),
            name,
            color,
            createdAt: Date.now()
        };

        await db.insert(teams).values(team).run();

        sendOne(reply, toTeamWithStats(team, zeroStats()), 201);
    });

    registerRoute(app, getTeamDetailRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const team = await db.select().from(teams).where(eq(teams.id, id)).get();
        if (!team) {
            sendError(reply, 404, "Team not found");
            return;
        }

        const projectRows = await db
            .select({ id: projects.id, name: projects.name, path: projects.path })
            .from(teamProjects)
            .innerJoin(projects, eq(teamProjects.projectId, projects.id))
            .where(eq(teamProjects.teamId, id))
            .all();

        sendOne(reply, {
            ...team,
            projects: projectRows.map((row): ITeamProjectRow => ({
                id: row.id,
                name: row.name,
                path: row.path
            }))
        });
    });

    registerRoute(app, updateTeamRoute, {}, async (request, reply) => {
        const { id } = request.params;
        const { name, color } = request.body;

        const existing = await db.select().from(teams).where(eq(teams.id, id)).get();
        if (!existing) {
            sendError(reply, 404, "Team not found");
            return;
        }

        if (name !== undefined && name !== existing.name) {
            const nameConflict = await db.select().from(teams).where(eq(teams.name, name)).get();
            if (nameConflict) {
                sendError(reply, 409, `A team named "${name}" already exists`);
                return;
            }
        }

        const updates = {
            name: name ?? existing.name,
            color: color ?? existing.color
        };

        await db.update(teams).set(updates).where(eq(teams.id, id)).run();

        const statsByTeam = await computeStatsByTeam(db);
        const updatedTeam: ITeamRow = { ...existing, ...updates };

        sendOne(reply, toTeamWithStats(updatedTeam, statsByTeam.get(id) ?? zeroStats()));
    });

    registerRoute(app, setTeamProjectsRoute, {}, async (request, reply) => {
        const { id } = request.params;
        const { projectIds } = request.body;

        const team = await db.select().from(teams).where(eq(teams.id, id)).get();
        if (!team) {
            sendError(reply, 404, "Team not found");
            return;
        }

        const uniqueProjectIds = [...new Set(projectIds)];

        db.transaction(tx => {
            tx.delete(teamProjects).where(eq(teamProjects.teamId, id)).run();

            if (uniqueProjectIds.length > 0) {
                tx.insert(teamProjects)
                    .values(
                        uniqueProjectIds.map(projectId => ({
                            id: generateId(),
                            teamId: id,
                            projectId
                        }))
                    )
                    .run();
            }
        });

        sendNone(reply);
    });

    registerRoute(app, deleteTeamRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const existing = await db.select().from(teams).where(eq(teams.id, id)).get();
        if (!existing) {
            sendError(reply, 404, "Team not found");
            return;
        }

        await db.delete(teams).where(eq(teams.id, id)).run();

        sendNone(reply, 204);
    });
}
