import { eq, and, sql, like, type SQL } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getTransitiveResolveStatusRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    getProjectTeamsRoute,
    setProjectTeamsRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "../../services/Security/index.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { projects, scanResults, teams, teamProjects } from "#api/db/schema.js";

export function registerProjectDetailRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const securityService = container.resolve(SecurityService);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    registerRoute(
        app,
        scanProjectAsyncRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, request.params.id))
                .get();
            if (!project) {
                sendError({ reply, statusCode: 404, message: "Project not found" });
                return;
            }

            const force = request.query.force === "true";
            const jobId = await jobWorker.enqueue({
                referenceId: project.id,
                referenceType: "project",
                type: "scan",
                packages: JSON.stringify({ force })
            });

            sendOne({ reply, data: { jobId } });
        }
    );

    registerRoute(app, getProjectDependenciesRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError({ reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const { dependencyKind, registryResolved, search, page, pageSize } = request.query;
        const resolvedPageSize = pageSize ?? 25;
        const resolvedPage = page ?? 1;
        const offset = (resolvedPage - 1) * resolvedPageSize;

        const conditions: SQL[] = [eq(scanResults.projectId, project.id)];
        if (dependencyKind && dependencyKind !== "all") {
            conditions.push(eq(scanResults.dependencyKind, dependencyKind));
        }
        if (registryResolved && registryResolved !== "all") {
            conditions.push(eq(scanResults.registryResolved, registryResolved === "true" ? 1 : 0));
        }
        if (search) {
            conditions.push(like(scanResults.name, `%${search}%`));
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
            .limit(resolvedPageSize)
            .offset(offset)
            .all();

        const dependencies = rows.map(row => ({
            name: row.name,
            currentVersion: row.currentVersion,
            latestVersion: row.latestVersion,
            latestInRange: row.latestInRange,
            type: row.type,
            upgradeType: row.upgradeType,
            dependencyKind: row.dependencyKind,
            registryResolved: row.registryResolved === 1
        }));

        sendList({ reply, items: dependencies, total });
    });

    registerRoute(app, getTransitiveResolveStatusRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError({ reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const countRow = await db
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
            .get();

        const total = countRow?.total ?? 0;
        const resolved = countRow?.resolved ?? 0;

        reply.send({ total, resolved, pending: total - resolved });
    });

    registerRoute(app, getProjectSecurityRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError({ reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const result = await securityService.getLatest(project.id);
        sendOne({ reply, data: result });
    });

    registerRoute(
        app,
        checkProjectSecurityRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, request.params.id))
                .get();
            if (!project) {
                sendError({ reply, statusCode: 404, message: "Project not found" });
                return;
            }

            const result = await securityService.check(project.id, project.path);
            sendOne({ reply, data: result });
        }
    );

    registerRoute(app, getProjectTeamsRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const rows = await db
            .select({ id: teams.id, name: teams.name, color: teams.color })
            .from(teamProjects)
            .innerJoin(teams, eq(teamProjects.teamId, teams.id))
            .where(eq(teamProjects.projectId, id))
            .all();

        sendList({ reply, items: rows, total: rows.length });
    });

    registerRoute(
        app,
        setProjectTeamsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { teamIds } = request.body;

            const project = await db.select().from(projects).where(eq(projects.id, id)).get();
            if (!project) {
                sendError({ reply, statusCode: 404, message: "Project not found" });
                return;
            }

            const uniqueTeamIds = [...new Set(teamIds)];

            db.transaction(tx => {
                tx.delete(teamProjects).where(eq(teamProjects.projectId, id)).run();

                if (uniqueTeamIds.length > 0) {
                    tx.insert(teamProjects)
                        .values(
                            uniqueTeamIds.map(teamId => ({
                                id: generateId(),
                                teamId,
                                projectId: id
                            }))
                        )
                        .run();
                }
            });

            sendNone(reply);
        }
    );
}
