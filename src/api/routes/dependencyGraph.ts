import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    getDependencyGraphRoute,
    refreshDependencyGraphRoute,
    getDependencyGraphStatsRoute,
    searchDependencyPackagesRoute
} from "#shared/routes/index.js";
import {
    GetDependencyGraphUseCase,
    SearchDependencyPackagesUseCase,
    RefreshDependencyGraphUseCase,
    GetDependencyGraphStatsUseCase
} from "./useCases/dependencyGraph/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function dependencyGraphRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, getDependencyGraphRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDependencyGraphUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            packageName: request.query.package
        });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, searchDependencyPackagesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(SearchDependencyPackagesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            query: request.query.query,
            limit: request.query.limit
        });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        refreshDependencyGraphRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(RefreshDependencyGraphUseCase);
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

    registerRoute(app, getDependencyGraphStatsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetDependencyGraphStatsUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
