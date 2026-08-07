import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { existsSync } from "fs";
import { join } from "path";
import { eq, and, sql, like, type SQL } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getTransitiveResolveStatusRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    getProjectTeamsRoute,
    setProjectTeamsRoute,
    exportProjectsRoute,
    importProjectsRoute,
    cloneProjectRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "../services/Security/index.js";
import { PackageManagerService } from "../services/abstractions/PackageManagerService.js";
import { JobWorker } from "../services/abstractions/JobWorker.js";
import { ScanSchedulerService } from "../services/ScanScheduler/index.js";
import { registerProject as registerProjectHelper } from "../services/registerProject.js";
import {
    projects,
    upgradeJobs,
    securityChecks,
    scanResults,
    teams,
    teamProjects
} from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

function extractRepoName(url: string): string | null {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
        return match[1]!;
    }
    const sshMatch = url.match(/:([^/]+?)(?:\.git)?$/);
    return sshMatch?.[1] ?? null;
}

export async function projectRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const securityService = container.resolve(SecurityService);
    const packageManagerService = container.resolve(PackageManagerService);
    const jobWorker = container.resolve(JobWorker);
    const scanSchedulerService = container.resolve(ScanSchedulerService);
    const { db } = databaseClient;

    // POST /api/projects — register project (name derived from package.json,
    // package manager detected via lockfile presence, version detected via
    // the detected package manager's CLI in the project directory).
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
                sendError(reply, 400, (error as Error).message);
                return;
            }

            void securityService.check(registered.id, projectPath);

            sendOne(
                reply,
                {
                    ...registered,
                    lastScannedAt: null,
                    hasNodeModules: existsSync(join(registered.path, "node_modules"))
                },
                201
            );
        }
    );

    // GET /api/projects — list all projects along with their latest security status.
    registerRoute(app, listProjectsRoute, {}, async (_request, reply) => {
        const allProjects = await db.select().from(projects).all();

        const teamRows = await db
            .select({
                projectId: teamProjects.projectId,
                teamId: teams.id,
                teamName: teams.name,
                teamColor: teams.color
            })
            .from(teamProjects)
            .innerJoin(teams, eq(teamProjects.teamId, teams.id))
            .all();

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
            allProjects.map(async project => {
                const security = await securityService.getLatest(project.id);
                return {
                    ...project,
                    security,
                    hasNodeModules: existsSync(join(project.path, "node_modules")),
                    teams: teamsByProject.get(project.id) ?? []
                };
            })
        );

        sendList(reply, withSecurity, withSecurity.length);
    });

    // GET /api/projects/export — project paths as JSON.
    registerRoute(app, exportProjectsRoute, {}, async (_request, reply) => {
        const allProjects = await db.select().from(projects).all();
        sendList(
            reply,
            allProjects.map(project => ({ path: project.path })),
            allProjects.length
        );
    });

    // POST /api/projects/import — add projects from a list of paths.
    registerRoute(
        app,
        importProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const results: {
                path: string;
                status: "added" | "skipped" | "failed";
                error?: string;
            }[] = [];

            for (const { path: projectPath } of request.body.items) {
                const existing = await db
                    .select()
                    .from(projects)
                    .where(eq(projects.path, projectPath))
                    .get();

                if (existing) {
                    results.push({ path: projectPath, status: "skipped" });
                    continue;
                }

                try {
                    const registered = await registerProjectHelper({
                        projectPath,
                        databaseClient,
                        packageManagerService
                    });

                    void securityService.check(registered.id, projectPath);
                    void jobWorker.enqueue({
                        referenceId: registered.id,
                        referenceType: "project",
                        type: "scan"
                    });

                    results.push({ path: projectPath, status: "added" });
                } catch (error) {
                    results.push({
                        path: projectPath,
                        status: "failed",
                        error: (error as Error).message
                    });
                }
            }

            sendList(reply, results, results.length);
        }
    );

    // POST /api/projects/clone — validate URL, extract repo name, enqueue a clone job.
    registerRoute(
        app,
        cloneProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { url, destination, folderName } = request.body;

            if (!url.startsWith("https://") && !url.startsWith("git@")) {
                sendError(reply, 400, "Only https:// and git@ URLs are supported");
                return;
            }

            const repoName = extractRepoName(url);
            if (!repoName) {
                sendError(reply, 400, "Could not extract repository name from URL");
                return;
            }

            const targetFolder = folderName ?? repoName;

            if (
                targetFolder.includes("/") ||
                targetFolder.includes("\\") ||
                targetFolder.includes("..")
            ) {
                sendError(reply, 400, "Folder name must not contain path separators or '..'");
                return;
            }

            const finalPath = join(destination, targetFolder);

            if (!existsSync(destination)) {
                sendError(reply, 400, `Destination directory does not exist: ${destination}`);
                return;
            }

            const existing = await db
                .select()
                .from(projects)
                .where(eq(projects.path, finalPath))
                .get();

            if (existing) {
                sendError(reply, 409, `A project is already registered at ${finalPath}`);
                return;
            }

            const jobId = await jobWorker.enqueue({
                referenceId: "clone",
                referenceType: "project",
                type: "clone",
                packages: JSON.stringify({ url, destination: finalPath })
            });

            sendOne(reply, { jobId });
        }
    );

    // GET /api/projects/:id
    registerRoute(app, getProjectRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }
        sendOne(reply, {
            ...project,
            hasNodeModules: existsSync(join(project.path, "node_modules"))
        });
    });

    // DELETE /api/projects/:id — cascade delete with 409 if a job is running.
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
                sendError(reply, 409, "Cannot delete project with running jobs");
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

    // POST /api/projects/:id/scan — enqueues an async scan job.
    // `?force=true` bypasses the registry cache.
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
                sendError(reply, 404, "Project not found");
                return;
            }

            const force = request.query.force === "true";
            const jobId = await jobWorker.enqueue({
                referenceId: project.id,
                referenceType: "project",
                type: "scan",
                packages: JSON.stringify({ force })
            });

            sendOne(reply, { jobId });
        }
    );

    // GET /api/projects/:id/dependencies — from the scan_results table, empty array on miss.
    registerRoute(app, getProjectDependenciesRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError(reply, 404, "Project not found");
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

        sendList(reply, dependencies, total);
    });

    // GET /api/projects/:id/transitive-resolve-status — counts of registry-resolved
    // vs pending transitive dependencies for a project.
    registerRoute(app, getTransitiveResolveStatusRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError(reply, 404, "Project not found");
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

        reply.send({
            total,
            resolved,
            pending: total - resolved
        });
    });

    // GET /api/projects/:id/security — latest persisted check result.
    registerRoute(app, getProjectSecurityRoute, {}, async (request, reply) => {
        const project = await db
            .select()
            .from(projects)
            .where(eq(projects.id, request.params.id))
            .get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        const result = await securityService.getLatest(project.id);
        sendOne(reply, result);
    });

    // POST /api/projects/:id/security — run a fresh security check.
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
                sendError(reply, 404, "Project not found");
                return;
            }

            const result = await securityService.check(project.id, project.path);
            sendOne(reply, result);
        }
    );

    // GET /api/projects/:id/teams — teams assigned to a project.
    registerRoute(app, getProjectTeamsRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const rows = await db
            .select({ id: teams.id, name: teams.name, color: teams.color })
            .from(teamProjects)
            .innerJoin(teams, eq(teamProjects.teamId, teams.id))
            .where(eq(teamProjects.projectId, id))
            .all();

        sendList(reply, rows, rows.length);
    });

    // PUT /api/projects/:id/teams — replace a project's team assignments.
    registerRoute(
        app,
        setProjectTeamsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { teamIds } = request.body;

            const project = await db.select().from(projects).where(eq(projects.id, id)).get();
            if (!project) {
                sendError(reply, 404, "Project not found");
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
