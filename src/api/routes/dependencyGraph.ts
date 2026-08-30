import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
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

export async function dependencyGraphRoutes(
    app: FastifyInstance,
    options: IPluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, getDependencyGraphRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDependencyGraphUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            packageName: request.query.package
        });

        return send.list({ result });
    });

    registerRoute(app, searchDependencyPackagesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(SearchDependencyPackagesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            query: request.query.query,
            limit: request.query.limit
        });

        return send.list({ result });
    });

    registerRoute(
        app,
        refreshDependencyGraphRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(RefreshDependencyGraphUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return send.list({ result });
        }
    );

    registerRoute(app, getDependencyGraphStatsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetDependencyGraphStatsUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return send.list({ result });
    });
}
