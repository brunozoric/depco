import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import {
    createUpgradeJobRoute,
    listJobsRoute,
    getJobRoute,
    createTransientJobRoute,
    listAllJobsRoute,
    cancelJobRoute,
    deleteJobsRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "../services/abstractions/JobWorker.js";
import { projects, scanResults, upgradeJobs } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IJobFilters {
    status?: string | undefined;
    type?: string | undefined;
    referenceId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}

interface ICountRow {
    count: number;
}

function buildJobConditions(filters: IJobFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.status) {
        conditions.push(eq(upgradeJobs.status, filters.status));
    }
    if (filters.type) {
        conditions.push(eq(upgradeJobs.type, filters.type));
    }
    if (filters.referenceId) {
        conditions.push(eq(upgradeJobs.referenceId, filters.referenceId));
    }
    if (filters.from) {
        conditions.push(gte(upgradeJobs.startedAt, parseInt(filters.from, 10)));
    }
    if (filters.to) {
        conditions.push(lte(upgradeJobs.startedAt, parseInt(filters.to, 10)));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function jobRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    // POST /api/projects/:id/jobs/upgrade — maps {name, targetVersion} to
    // {name, from, to} using the latest scan results, then enqueues a
    // dependency job. If `refreshTransient` is true, it's forwarded to the
    // worker, which chains a transient job after the dependency job completes.
    registerRoute(app, createUpgradeJobRoute, {}, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;

        const project = await db.select().from(projects).where(eq(projects.id, id)).get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        const scanned = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, id))
            .all();
        const packagesWithFrom = body.packages.map(pkg => {
            const found = scanned.find(dep => dep.name === pkg.name);
            return {
                name: pkg.name,
                from: found?.currentVersion ?? "unknown",
                to: pkg.targetVersion
            };
        });

        try {
            const jobId = await jobWorker.enqueue({
                referenceId: id,
                referenceType: "project",
                type: "dependency",
                packages: packagesWithFrom,
                refreshTransient: body.refreshTransient === true
            });

            sendOne(reply, { jobId });
        } catch (error) {
            sendError(reply, 403, (error as Error).message);
        }
    });

    // POST /api/projects/:id/jobs/transient — enqueue a standalone
    // transient (refresh) job.
    registerRoute(app, createTransientJobRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const project = await db.select().from(projects).where(eq(projects.id, id)).get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        try {
            const jobId = await jobWorker.enqueue({
                referenceId: id,
                referenceType: "project",
                type: "transient"
            });

            sendOne(reply, { jobId });
        } catch (error) {
            sendError(reply, 403, (error as Error).message);
        }
    });

    // GET /api/projects/:id/jobs/:jobId — job status + logs.
    registerRoute(app, getJobRoute, {}, async (request, reply) => {
        const job = await jobWorker.getJob(request.params.jobId);
        if (!job || job.referenceId !== request.params.id) {
            sendError(reply, 404, "Job not found");
            return;
        }
        sendOne(reply, job);
    });

    // GET /api/projects/:id/jobs — job history for the project.
    registerRoute(app, listJobsRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const project = await db.select().from(projects).where(eq(projects.id, id)).get();
        if (!project) {
            sendError(reply, 404, "Project not found");
            return;
        }

        const jobs = await jobWorker.getJobsForReference(id);
        sendList(reply, jobs, jobs.length);
    });

    // GET /api/jobs — jobs across all projects with filtering, pagination, sorting.
    registerRoute(app, listAllJobsRoute, {}, async (request, reply) => {
        const { status, type, referenceId, from, to, limit, offset } = request.query;
        const where = buildJobConditions({ status, type, referenceId, from, to });

        const parsedLimit = limit ? parseInt(limit, 10) : 50;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;

        const [items, countResult] = await Promise.all([
            db
                .select()
                .from(upgradeJobs)
                .where(where)
                .orderBy(
                    sql`CASE WHEN ${upgradeJobs.startedAt} IS NULL THEN 1 ELSE 0 END`,
                    sql`${upgradeJobs.startedAt} DESC`
                )
                .limit(parsedLimit)
                .offset(parsedOffset)
                .all(),
            db
                .select({ count: sql<number>`COUNT(*)` })
                .from(upgradeJobs)
                .where(where)
                .get() as ICountRow | undefined
        ]);

        sendList(reply, items, countResult?.count ?? 0);
    });

    // POST /api/jobs/:jobId/cancel — cancel or kill a job.
    registerRoute(app, cancelJobRoute, {}, async (request, reply) => {
        const { jobId } = request.params;
        const job = await jobWorker.getJob(jobId);
        if (!job) {
            sendError(reply, 404, "Job not found");
            return;
        }
        await jobWorker.cancelJob(jobId);
        sendNone(reply);
    });

    // DELETE /api/jobs — bulk delete jobs matching filters.
    registerRoute(app, deleteJobsRoute, {}, async (request, reply) => {
        const { status, type, referenceId, from, to } = request.body;
        const where = buildJobConditions({ status, type, referenceId, from, to });

        const countResult = (await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(upgradeJobs)
            .where(where)
            .get()) as ICountRow | undefined;

        const deleted = countResult?.count ?? 0;

        if (where) {
            await db.delete(upgradeJobs).where(where).run();
        } else {
            await db.delete(upgradeJobs).run();
        }

        reply.send({ deleted });
    });
}
