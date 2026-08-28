import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { installProjectRoute, getInstallOptionsRoute } from "#shared/routes/index.js";
import { InstallProjectUseCase, GetInstallOptionsUseCase } from "./useCases/install/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function installRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(
        app,
        installProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(InstallProjectUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                flags: request.body.flags
            });

            return send.one({ result });
        }
    );

    // GET /api/install-options/:packageManager — available install flags for a driver.
    registerRoute(app, getInstallOptionsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetInstallOptionsUseCase);
        const result = await useCase.execute({ packageManager: request.params.packageManager });

        return send.list({ result });
    });
}
