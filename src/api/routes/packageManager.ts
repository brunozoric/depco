import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getPackageManagerRoute, updatePackageManagerRoute } from "#shared/routes/index.js";
import {
    GetPackageManagerUseCase,
    UpdatePackageManagerUseCase
} from "./useCases/packageManager/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function packageManagerRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    // GET /api/projects/:id/package-manager — current package manager version.
    registerRoute(app, getPackageManagerRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetPackageManagerUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.one({ result });
    });

    // POST /api/projects/:id/package-manager/update — enqueue a package
    // manager version update job.
    registerRoute(
        app,
        updatePackageManagerRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdatePackageManagerUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                version: request.body.version
            });

            return send.one({ result });
        }
    );
}
