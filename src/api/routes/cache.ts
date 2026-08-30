import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { clearCacheRoute, clearPackageCacheRoute } from "#shared/routes/index.js";
import { ClearCacheUseCase, ClearPackageCacheUseCase } from "./useCases/cache/index.js";

export async function cacheRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;

    // DELETE /api/cache — clear the entire registry cache.
    registerRoute(
        app,
        clearCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (_request, _reply, send) => {
            const useCase = container.resolve(ClearCacheUseCase);
            const result = await useCase.execute({});

            return send.list({ result });
        }
    );

    // DELETE /api/cache/:packageName — clear a single package's cache entry.
    registerRoute(
        app,
        clearPackageCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ClearPackageCacheUseCase);
            const result = await useCase.execute({ packageName: request.params.packageName });

            return send.list({ result });
        }
    );
}
