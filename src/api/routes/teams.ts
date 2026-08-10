import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, sql } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
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
import { computeStatsByTeam, zeroStats, type ITeamStats } from "./teams/teamStatsHelper.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface ITeamRow {
    id: string;
    name: string;
    color: string;
    createdAt: number;
}

interface ITeamWithStats extends ITeamRow, ITeamStats {}

interface ITeamProjectRow {
    id: string;
    name: string;
    path: string;
}

function toTeamWithStats(team: ITeamRow, stats: ITeamStats): ITeamWithStats {
    return { ...team, ...stats };
}

export async function teamsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listTeamsRoute, {}, async (request, reply) => {
        const page = request.query.page ?? 1;
        const pageSize = request.query.pageSize ?? 50;
        const offset = (page - 1) * pageSize;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(teams)
            .get();
        const total = countResult?.count ?? 0;

        const pagedTeams = await db.select().from(teams).limit(pageSize).offset(offset).all();

        const statsByTeam = await computeStatsByTeam(db);

        const items = pagedTeams.map(team =>
            toTeamWithStats(team, statsByTeam.get(team.id) ?? zeroStats())
        );

        sendList({ reply, items, total });
    });

    registerRoute(
        app,
        createTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { name, color } = request.body;

            const existing = await db.select().from(teams).where(eq(teams.name, name)).get();
            if (existing) {
                sendError({
                    reply: reply,
                    statusCode: 409,
                    message: `A team named "${name}" already exists`
                });
                return;
            }

            const team: ITeamRow = {
                id: generateId(),
                name,
                color,
                createdAt: Date.now()
            };

            await db.insert(teams).values(team).run();

            sendOne({ reply: reply, data: toTeamWithStats(team, zeroStats()), status: 201 });
        }
    );

    registerRoute(app, getTeamDetailRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const team = await db.select().from(teams).where(eq(teams.id, id)).get();
        if (!team) {
            sendError({ reply: reply, statusCode: 404, message: "Team not found" });
            return;
        }

        const projectRows = await db
            .select({ id: projects.id, name: projects.name, path: projects.path })
            .from(teamProjects)
            .innerJoin(projects, eq(teamProjects.projectId, projects.id))
            .where(eq(teamProjects.teamId, id))
            .all();

        sendOne({
            reply: reply,
            data: {
                ...team,
                projects: projectRows.map((row): ITeamProjectRow => ({
                    id: row.id,
                    name: row.name,
                    path: row.path
                }))
            }
        });
    });

    registerRoute(
        app,
        updateTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { name, color } = request.body;

            const existing = await db.select().from(teams).where(eq(teams.id, id)).get();
            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Team not found" });
                return;
            }

            if (name !== undefined && name !== existing.name) {
                const nameConflict = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.name, name))
                    .get();
                if (nameConflict) {
                    sendError({
                        reply: reply,
                        statusCode: 409,
                        message: `A team named "${name}" already exists`
                    });
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

            sendOne({
                reply: reply,
                data: toTeamWithStats(updatedTeam, statsByTeam.get(id) ?? zeroStats())
            });
        }
    );

    registerRoute(
        app,
        setTeamProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { projectIds } = request.body;

            const team = await db.select().from(teams).where(eq(teams.id, id)).get();
            if (!team) {
                sendError({ reply: reply, statusCode: 404, message: "Team not found" });
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
        }
    );

    registerRoute(
        app,
        deleteTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;

            const existing = await db.select().from(teams).where(eq(teams.id, id)).get();
            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Team not found" });
                return;
            }

            await db.delete(teams).where(eq(teams.id, id)).run();

            sendNone(reply, 204);
        }
    );
}
