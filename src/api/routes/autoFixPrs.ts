import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listAutoFixPullRequestsRoute,
    getProjectAutoFixPullRequestsRoute,
    generateAutoFixPrRoute,
    deleteAutoFixPullRequestRoute
} from "#shared/routes/index.js";
import {
    ListAutoFixPullRequestsUseCase,
    DeleteAutoFixPullRequestUseCase,
    GetProjectAutoFixPullRequestsUseCase,
    GenerateAutoFixPrUseCase
} from "./useCases/autoFix/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function autoFixPrRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    // Registered before the parametrized "/:projectId/..." routes below so it
    // isn't shadowed by them.
    registerRoute(app, listAutoFixPullRequestsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListAutoFixPullRequestsUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    // Also registered before "/:projectId/pull-requests" — the fixed
    // "pull-requests" segment here sits one level deeper than that route's
    // ":projectId" segment, but keeping fixed-prefix routes grouped together
    // up front avoids any ambiguity as routes are added.
    registerRoute(
        app,
        deleteAutoFixPullRequestRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteAutoFixPullRequestUseCase);
            const result = await useCase.execute({ id: request.params.id });

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, getProjectAutoFixPullRequestsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectAutoFixPullRequestsUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            status: request.query.status
        });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        generateAutoFixPrRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(GenerateAutoFixPrUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

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
