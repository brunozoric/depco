import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createUpgradeJobRoute,
    listJobsRoute,
    getJobRoute,
    createTransientJobRoute,
    listAllJobsRoute,
    cancelJobRoute,
    deleteJobsRoute
} from "#shared/routes/index.js";
import {
    UpgradeJobUseCase,
    CreateTransientJobUseCase,
    GetJobUseCase,
    ListProjectJobsUseCase,
    ListAllJobsUseCase,
    CancelJobUseCase,
    DeleteJobsUseCase
} from "./useCases/jobs/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function jobRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    // POST /api/projects/:id/jobs/upgrade — maps {name, targetVersion} to
    // {name, from, to} using the latest scan results, then enqueues a
    // dependency job. If `refreshTransient` is true, it's forwarded to the
    // worker, which chains a transient job after the dependency job completes.
    registerRoute(
        app,
        createUpgradeJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpgradeJobUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                packages: request.body.packages,
                refreshTransient: request.body.refreshTransient
            });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    // POST /api/projects/:id/jobs/transient — enqueue a standalone
    // transient (refresh) job.
    registerRoute(
        app,
        createTransientJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateTransientJobUseCase);
            const result = await useCase.execute({ projectId: request.params.id });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    // GET /api/projects/:id/jobs/:jobId — job status + logs.
    registerRoute(app, getJobRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetJobUseCase);
        const result = await useCase.execute({
            projectId: request.params.id,
            jobId: request.params.jobId
        });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    // GET /api/projects/:id/jobs — job history for the project.
    registerRoute(app, listJobsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListProjectJobsUseCase);
        const result = await useCase.execute({ projectId: request.params.id });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    // GET /api/jobs — jobs across all projects with filtering, pagination, sorting.
    registerRoute(app, listAllJobsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListAllJobsUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    // POST /api/jobs/:jobId/cancel — cancel or kill a job.
    registerRoute(
        app,
        cancelJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CancelJobUseCase);
            const result = await useCase.execute({ jobId: request.params.jobId });

            result.match({
                ok: () => sendNone(reply),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    // DELETE /api/jobs — bulk delete jobs matching filters.
    registerRoute(
        app,
        deleteJobsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteJobsUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
