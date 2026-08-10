import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import {
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licenseViolations, projects, teamProjects } from "#api/db/schema.js";

interface ILicenseViolationQuerystring {
    projectId?: string | undefined;
    action?: string | undefined;
    packageName?: string | undefined;
    teamId?: string | undefined;
}

function buildViolationConditions(query: ILicenseViolationQuerystring): SQL[] {
    const conditions: SQL[] = [];
    if (query.projectId) {
        conditions.push(eq(licenseViolations.projectId, query.projectId));
    }
    if (query.action) {
        conditions.push(eq(licenseViolations.action, query.action));
    }
    if (query.packageName) {
        conditions.push(like(licenseViolations.packageName, `%${query.packageName}%`));
    }
    if (query.teamId) {
        conditions.push(
            sql`${licenseViolations.projectId} IN (SELECT project_id FROM team_projects WHERE team_id = ${query.teamId})`
        );
    }
    return conditions;
}

interface IViolationProjectSummary {
    projectId: string;
    projectName: string;
    warnCount: number;
    denyCount: number;
}

interface ILicenseViolationsSummary {
    total: number;
    warnCount: number;
    denyCount: number;
    byProject: IViolationProjectSummary[];
}

async function resolveTeamProjectIds(
    db: DatabaseClient.Interface["db"],
    teamId: string
): Promise<string[]> {
    const rows = await db
        .select({ projectId: teamProjects.projectId })
        .from(teamProjects)
        .where(eq(teamProjects.teamId, teamId))
        .all();
    return rows.map(row => row.projectId);
}

async function buildViolationsSummary(
    db: DatabaseClient.Interface["db"],
    teamId?: string
): Promise<ILicenseViolationsSummary> {
    const teamProjectIds = teamId ? await resolveTeamProjectIds(db, teamId) : undefined;
    const teamFilter = teamProjectIds
        ? inArray(licenseViolations.projectId, teamProjectIds)
        : undefined;
    const allViolations = await db.select().from(licenseViolations).where(teamFilter).all();
    const projectRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .all();
    const projectNameById = new Map(projectRows.map(row => [row.id, row.name]));

    let warnCount = 0;
    let denyCount = 0;
    const byProjectMap = new Map<string, IViolationProjectSummary>();

    for (const violation of allViolations) {
        let projectSummary = byProjectMap.get(violation.projectId);
        if (!projectSummary) {
            projectSummary = {
                projectId: violation.projectId,
                projectName: projectNameById.get(violation.projectId) ?? violation.projectId,
                warnCount: 0,
                denyCount: 0
            };
            byProjectMap.set(violation.projectId, projectSummary);
        }

        if (violation.action === "warn") {
            warnCount += 1;
            projectSummary.warnCount += 1;
        } else if (violation.action === "deny") {
            denyCount += 1;
            projectSummary.denyCount += 1;
        }
    }

    return {
        total: allViolations.length,
        warnCount,
        denyCount,
        byProject: Array.from(byProjectMap.values())
    };
}

export function registerLicenseViolationRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listLicenseViolationsRoute, {}, async (request, reply) => {
        const page = request.query.page ?? 1;
        const pageSize = request.query.pageSize ?? 50;
        const offset = (page - 1) * pageSize;

        const conditions = buildViolationConditions(request.query);
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(licenseViolations)
            .where(where)
            .get();
        const total = countResult?.count ?? 0;

        const items = await db
            .select()
            .from(licenseViolations)
            .where(where)
            .limit(pageSize)
            .offset(offset)
            .all();
        sendList({ reply, items, total });
    });

    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const summary = await buildViolationsSummary(db, teamId);
        reply.send(summary);
    });
}
