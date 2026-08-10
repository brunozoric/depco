import { existsSync } from "fs";
import { join } from "path";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "../../services/Security/index.js";
import { PackageManagerService } from "../../services/PackageManager/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { registerProject as registerProjectHelper } from "../../utils/registerProject.js";
import {
    projects,
    upgradeJobs,
    securityChecks,
    scanResults,
    teams,
    teamProjects
} from "#api/db/schema.js";

export function registerProjectCrudRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const securityService = container.resolve(SecurityService);
    const packageManagerService = container.resolve(PackageManagerService);
    const scanSchedulerService = container.resolve(ScanSchedulerService);
    const { db } = databaseClient;

    registerRoute(
        app,
        createProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { path: projectPath } = request.body;

            let registered;
            try {
                registered = await registerProjectHelper({
                    projectPath,
                    databaseClient,
                    packageManagerService
                });
            } catch (error) {
                sendError({ reply, statusCode: 400, message: (error as Error).message });
                return;
            }

            void securityService.check(registered.id, projectPath);

            sendOne({
                reply,
                data: {
                    ...registered,
                    lastScannedAt: null,
                    hasNodeModules: existsSync(join(registered.path, "node_modules"))
                },
                status: 201
            });
        }
    );

    registerRoute(app, listProjectsRoute, {}, async (request, reply) => {
        const page = request.query.page ?? 1;
        const pageSize = request.query.pageSize ?? 50;
        const offset = (page - 1) * pageSize;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(projects)
            .get();
        const total = countResult?.count ?? 0;

        const pagedProjects = await db.select().from(projects).limit(pageSize).offset(offset).all();

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

        const teamsByProject = new Map<
            string,
            Array<{ id: string; name: string; color: string }>
        >();
        for (const row of teamRows) {
            const list = teamsByProject.get(row.projectId) ?? [];
            list.push({ id: row.teamId, name: row.teamName, color: row.teamColor });
            teamsByProject.set(row.projectId, list);
        }

        const withSecurity = await Promise.all(
            pagedProjects.map(async project => {
                const security = await securityService.getLatest(project.id);
                return {
                    ...project,
                    security,
                    hasNodeModules: existsSync(join(project.path, "node_modules")),
                    teams: teamsByProject.get(project.id) ?? []
                };
            })
        );

        sendList({ reply, items: withSecurity, total });
    });

    registerRoute(app, getProjectRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError({ reply, statusCode: 404, message: "Project not found" });
            return;
        }
        sendOne({
            reply,
            data: {
                ...project,
                hasNodeModules: existsSync(join(project.path, "node_modules"))
            }
        });
    });

    registerRoute(
        app,
        deleteProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;

            const runningJob = await db
                .select()
                .from(upgradeJobs)
                .where(and(eq(upgradeJobs.referenceId, id), eq(upgradeJobs.status, "running")))
                .get();

            if (runningJob) {
                sendError({
                    reply,
                    statusCode: 409,
                    message: "Cannot delete project with running jobs"
                });
                return;
            }

            await scanSchedulerService.unscheduleProject(id);

            await db.delete(scanResults).where(eq(scanResults.projectId, id)).run();
            await db.delete(securityChecks).where(eq(securityChecks.projectId, id)).run();
            await db.delete(upgradeJobs).where(eq(upgradeJobs.referenceId, id)).run();
            await db.delete(projects).where(eq(projects.id, id)).run();

            sendNone(reply, 204);
        }
    );
}
