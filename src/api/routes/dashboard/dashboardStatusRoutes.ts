import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { registerRoute, sendList } from "#shared/routing/index.js";
import {
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    dashboardDependencyChangesRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { dependencyChanges, projects } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";

interface IRawActivityRow {
    id: string;
    type: string;
    referenceId: string;
    referenceType: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
}

interface IRawStalenessRow {
    projectId: string;
    projectName: string;
    lastScannedAt: number | null;
}

interface IRawSecurityRow {
    projectId: string;
    projectName: string;
    totalChecks: number;
    passingChecks: number;
}

interface ICountRow {
    count: number;
}

export function registerDashboardStatusRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, dashboardActivityRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId
            ? sql`WHERE reference_type = 'project' AND reference_id IN ${teamProjectIds(teamId)}`
            : sql``;

        const rows = await db.all<IRawActivityRow>(sql`
            SELECT
                id, type, reference_id AS referenceId, reference_type AS referenceType,
                status, started_at AS startedAt, completed_at AS completedAt
            FROM upgrade_jobs
            ${teamCondition}
            ORDER BY started_at DESC
            LIMIT 20
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardStalenessRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId ? sql`WHERE id IN ${teamProjectIds(teamId)}` : sql``;

        const rows = await db.all<IRawStalenessRow>(sql`
            SELECT
                id AS projectId,
                name AS projectName,
                last_scanned_at AS lastScannedAt
            FROM projects
            ${teamCondition}
            ORDER BY
                CASE WHEN last_scanned_at IS NULL THEN 0 ELSE 1 END ASC,
                last_scanned_at ASC
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardSecurityRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId ? sql`AND sc.project_id IN ${teamProjectIds(teamId)}` : sql``;

        const rows = await db.all<IRawSecurityRow>(sql`
            SELECT
                sc.project_id AS projectId,
                p.name AS projectName,
                json_array_length(sc.results) AS totalChecks,
                sc.passes AS passingChecks
            FROM security_checks sc
            INNER JOIN projects p ON sc.project_id = p.id
            WHERE sc.checked_at = (
                SELECT MAX(sc2.checked_at)
                FROM security_checks sc2
                WHERE sc2.project_id = sc.project_id
            )
            ${teamCondition}
            ORDER BY
                CASE WHEN json_array_length(sc.results) = 0 THEN 2
                ELSE CAST(sc.passes AS REAL) / json_array_length(sc.results) END ASC
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardDependencyChangesRoute, {}, async (request, reply) => {
        const { projectId, limit, teamId } = request.query;

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

        sendList({ reply: reply, items: items, total: countResult?.count ?? 0 });
    });
}
