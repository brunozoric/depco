import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
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

export async function jobRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;

    // POST /api/projects/:id/jobs/upgrade — maps {name, targetVersion} to
    // {name, from, to} using the latest scan results, then enqueues a
    // dependency job. If `refreshTransient` is true, it's forwarded to the
    // worker, which chains a transient job after the dependency job completes.
    registerRoute(
        app,
        createUpgradeJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpgradeJobUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                packages: request.body.packages,
                refreshTransient: request.body.refreshTransient
            });

            return send.one({ result });
        }
    );

    // POST /api/projects/:id/jobs/transient — enqueue a standalone
    // transient (refresh) job.
    registerRoute(
        app,
        createTransientJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateTransientJobUseCase);
            const result = await useCase.execute({ projectId: request.params.id });

            return send.one({ result });
        }
    );

    // GET /api/projects/:id/jobs/:jobId — job status + logs.
    registerRoute(app, getJobRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetJobUseCase);
        const result = await useCase.execute({
            projectId: request.params.id,
            jobId: request.params.jobId
        });

        return send.one({ result });
    });

    // GET /api/projects/:id/jobs — job history for the project.
    registerRoute(app, listJobsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListProjectJobsUseCase);
        const result = await useCase.execute({ projectId: request.params.id });

        return send.list({ result });
    });

    // GET /api/jobs — jobs across all projects with filtering, pagination, sorting.
    registerRoute(app, listAllJobsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListAllJobsUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    // POST /api/jobs/:jobId/cancel — cancel or kill a job.
    registerRoute(
        app,
        cancelJobRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CancelJobUseCase);
            const result = await useCase.execute({ jobId: request.params.jobId });

            return send.none({ result });
        }
    );

    // DELETE /api/jobs — bulk delete jobs matching filters.
    registerRoute(
        app,
        deleteJobsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteJobsUseCase);
            const result = await useCase.execute(request.body);

            return send.list({ result });
        }
    );
}
