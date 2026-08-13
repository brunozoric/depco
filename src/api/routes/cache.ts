import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { clearCacheRoute, clearPackageCacheRoute } from "#shared/routes/index.js";
import { ClearCacheUseCase, ClearPackageCacheUseCase } from "./useCases/cache/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function cacheRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    // DELETE /api/cache — clear the entire registry cache.
    registerRoute(
        app,
        clearCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (_request, reply) => {
            const useCase = container.resolve(ClearCacheUseCase);
            const result = await useCase.execute({});

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    // DELETE /api/cache/:packageName — clear a single package's cache entry.
    registerRoute(
        app,
        clearPackageCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ClearPackageCacheUseCase);
            const result = await useCase.execute({ packageName: request.params.packageName });

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
