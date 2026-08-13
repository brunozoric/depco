import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
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

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
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

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(app, getProjectAutoFixPullRequestsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectAutoFixPullRequestsUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            status: request.query.status
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        generateAutoFixPrRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(GenerateAutoFixPrUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return sendList({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
