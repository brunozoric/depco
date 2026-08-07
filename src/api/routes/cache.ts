import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendNone } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { clearCacheRoute, clearPackageCacheRoute } from "#shared/routes/index.js";
import { RegistryCacheService } from "../services/abstractions/RegistryCacheService.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function cacheRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const registryCacheService = container.resolve(RegistryCacheService);

    // DELETE /api/cache — clear the entire registry cache.
    registerRoute(
        app,
        clearCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (_request, reply) => {
            await registryCacheService.clearAll();
            sendNone(reply);
        }
    );

    // DELETE /api/cache/:packageName — clear a single package's cache entry.
    registerRoute(
        app,
        clearPackageCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            await registryCacheService.clearPackage(request.params.packageName);
            sendNone(reply);
        }
    );
}
