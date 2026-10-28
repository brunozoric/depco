import type { FastifyInstance } from "fastify";
import { registerRoute } from "#shared/routing/index.js";
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

export async function packagesRoutes(app: FastifyInstance): Promise<void> {
    registerRoute(app, listPackagesRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(ListPackagesUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(app, getPackageDetailRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(GetPackageDetailUseCase);
        const result = await useCase.execute({ packageName: request.params.packageName });

        return send.one({ result });
    });

    registerRoute(
        app,
        rescanPackageRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(RescanPackageUseCase);
            const result = await useCase.execute({ packageName: request.params.packageName });

            return send.one({ result });
        }
    );
}
