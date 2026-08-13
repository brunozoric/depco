import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getPackageDetailRoute
} from "#shared/routes/index.js";
import {
    ListPackagesUseCase,
    GetPackageDetailUseCase,
    RescanPackageUseCase
} from "./useCases/packages/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function packagesRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listPackagesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListPackagesUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => {
                reply.send(data);
            },
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getPackageDetailRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetPackageDetailUseCase);
        const result = await useCase.execute({ packageName: request.params.packageName });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        rescanPackageRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(RescanPackageUseCase);
            const result = await useCase.execute({ packageName: request.params.packageName });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
