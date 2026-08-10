import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listLicensesRoute,
    getLicenseSummaryRoute,
    getProjectLicensesRoute,
    scanProjectLicensesRoute,
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { licenses, licenseViolations, projects, teamProjects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface ILicenseQuerystring {
    projectId?: string | undefined;
    riskTier?: string | undefined;
    spdxId?: string | undefined;
    packageName?: string | undefined;
    teamId?: string | undefined;
    violationAction?: string | undefined;
}

function buildLicenseConditions(query: ILicenseQuerystring): SQL[] {
    const conditions: SQL[] = [];
    if (query.projectId) {
        conditions.push(eq(licenses.projectId, query.projectId));
    }
    if (query.riskTier) {
        conditions.push(eq(licenses.riskTier, query.riskTier));
    }
    if (query.spdxId) {
        conditions.push(eq(licenses.spdxId, query.spdxId));
    }
    if (query.packageName) {
        conditions.push(like(licenses.packageName, `%${query.packageName}%`));
    }
    if (query.teamId) {
        conditions.push(
            sql`${licenses.projectId} IN (SELECT project_id FROM team_projects WHERE team_id = ${query.teamId})`
        );
    }
    if (query.violationAction) {
        conditions.push(
            sql`${licenses.id} IN (
                SELECT lv.license_id FROM license_violations lv
                WHERE lv.license_id = ${licenses.id}
                GROUP BY lv.license_id
                HAVING MAX(CASE WHEN lv.action = 'deny' THEN 2 WHEN lv.action = 'warn' THEN 1 ELSE 0 END)
                    = ${query.violationAction === "deny" ? 2 : 1}
            )`
        );
    }
    return conditions;
}

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

interface IRiskTierCounts {
    permissive: number;
    "weak-copyleft": number;
    copyleft: number;
    proprietary: number;
    unknown: number;
}

interface IViolationActionCounts {
    warn: number;
    deny: number;
}

interface ILicenseProjectSummary {
    projectId: string;
    projectName: string;
    total: number;
    denied: number;
    warned: number;
}

interface ILicenseSummary {
    totalPackages: number;
    compliantPercent: number;
    riskTierCounts: IRiskTierCounts;
    violationCounts: IViolationActionCounts;
    projectSummaries: ILicenseProjectSummary[];
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

async function buildLicenseSummary(
    db: DatabaseClient.Interface["db"],
    teamId?: string,
    projectId?: string
): Promise<ILicenseSummary> {
    const teamProjectIds = teamId ? await resolveTeamProjectIds(db, teamId) : undefined;

    const licenseConditions: SQL[] = [];
    if (teamProjectIds) {
        licenseConditions.push(inArray(licenses.projectId, teamProjectIds));
    }
    if (projectId) {
        licenseConditions.push(eq(licenses.projectId, projectId));
    }
    const licenseFilter = licenseConditions.length > 0 ? and(...licenseConditions) : undefined;

    const violationConditions: SQL[] = [];
    if (teamProjectIds) {
        violationConditions.push(inArray(licenseViolations.projectId, teamProjectIds));
    }
    if (projectId) {
        violationConditions.push(eq(licenseViolations.projectId, projectId));
    }
    const violationFilter =
        violationConditions.length > 0 ? and(...violationConditions) : undefined;

    const allLicenses = await db.select().from(licenses).where(licenseFilter).all();
    const allViolations = await db.select().from(licenseViolations).where(violationFilter).all();
    const projectRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .all();
    const projectNameById = new Map(projectRows.map(row => [row.id, row.name]));

    const uniquePackages = new Map<string, (typeof allLicenses)[number]>();
    for (const license of allLicenses) {
        if (!uniquePackages.has(license.packageName)) {
            uniquePackages.set(license.packageName, license);
        }
    }

    const riskTierCounts: IRiskTierCounts = {
        permissive: 0,
        "weak-copyleft": 0,
        copyleft: 0,
        proprietary: 0,
        unknown: 0
    };
    for (const license of uniquePackages.values()) {
        if (license.riskTier in riskTierCounts) {
            riskTierCounts[license.riskTier as keyof IRiskTierCounts] += 1;
        }
    }

    const deniedPackageNames = new Set<string>();
    const violationCounts: IViolationActionCounts = { warn: 0, deny: 0 };
    const seenViolationPackages = new Map<string, string>();
    for (const violation of allViolations) {
        const existing = seenViolationPackages.get(violation.packageName);
        if (existing === violation.action) {
            continue;
        }
        seenViolationPackages.set(violation.packageName, violation.action);
        if (violation.action === "warn") {
            violationCounts.warn += 1;
        } else if (violation.action === "deny") {
            violationCounts.deny += 1;
            deniedPackageNames.add(violation.packageName);
        }
    }

    const totalPackages = uniquePackages.size;
    const compliantPercent =
        totalPackages > 0
            ? Math.round(((totalPackages - deniedPackageNames.size) / totalPackages) * 100)
            : 100;

    const summaryByProject = new Map<string, ILicenseProjectSummary>();
    const getOrCreateProjectSummary = (projectId: string): ILicenseProjectSummary => {
        let existing = summaryByProject.get(projectId);
        if (!existing) {
            existing = {
                projectId,
                projectName: projectNameById.get(projectId) ?? projectId,
                total: 0,
                denied: 0,
                warned: 0
            };
            summaryByProject.set(projectId, existing);
        }
        return existing;
    };

    for (const license of allLicenses) {
        getOrCreateProjectSummary(license.projectId).total += 1;
    }
    for (const violation of allViolations) {
        const summary = getOrCreateProjectSummary(violation.projectId);
        if (violation.action === "deny") {
            summary.denied += 1;
        } else if (violation.action === "warn") {
            summary.warned += 1;
        }
    }

    return {
        totalPackages,
        compliantPercent,
        riskTierCounts,
        violationCounts,
        projectSummaries: Array.from(summaryByProject.values())
    };
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

export async function licenseRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    registerRoute(app, listLicensesRoute, {}, async (request, reply) => {
        const conditions = buildLicenseConditions(request.query);
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const page = request.query.page ?? 1;
        const pageSize = request.query.pageSize ?? 50;
        const sortBy = request.query.sortBy ?? "packageName";
        const direction = request.query.sortOrder === "desc" ? desc : asc;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(licenses)
            .where(where)
            .get();
        const total = countResult?.count ?? 0;

        function resolveOrderBy(): SQL {
            switch (sortBy) {
                case "licenseName":
                    return direction(licenses.licenseName);
                case "riskTier":
                    return direction(licenses.riskTier);
                case "projectName":
                    return direction(
                        sql`(SELECT ${projects.name} FROM ${projects} WHERE ${projects.id} = ${licenses.projectId})`
                    );
                default:
                    return direction(licenses.packageName);
            }
        }

        const items = await db
            .select()
            .from(licenses)
            .where(where)
            .orderBy(resolveOrderBy())
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .all();
        sendList({ reply: reply, items: items, total: total });
    });

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, getLicenseSummaryRoute, {}, async (request, reply) => {
        const { teamId, projectId } = request.query;
        const summary = await buildLicenseSummary(db, teamId, projectId);
        reply.send(summary);
    });

    registerRoute(app, getProjectLicensesRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const conditions = [
            eq(licenses.projectId, projectId),
            ...buildLicenseConditions(request.query)
        ];
        const items = await db
            .select()
            .from(licenses)
            .where(and(...conditions))
            .all();
        sendList({ reply: reply, items: items, total: items.length });
    });

    registerRoute(
        app,
        scanProjectLicensesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, projectId))
                .get();
            if (!project) {
                sendError({ reply: reply, statusCode: 404, message: "Project not found" });
                return;
            }

            const jobId = await jobWorker.enqueue({
                referenceId: projectId,
                referenceType: "project",
                type: "scan"
            });
            reply.send({ jobId });
        }
    );

    registerRoute(app, listLicenseViolationsRoute, {}, async (request, reply) => {
        const conditions = buildViolationConditions(request.query);
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const items = await db.select().from(licenseViolations).where(where).all();
        sendList({ reply: reply, items: items, total: items.length });
    });

    // Registered before any parametrized license-violation routes so it isn't
    // shadowed by them (none exist today, but this mirrors the license routes above).
    registerRoute(app, getLicenseViolationsSummaryRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const summary = await buildViolationsSummary(db, teamId);
        reply.send(summary);
    });
}
