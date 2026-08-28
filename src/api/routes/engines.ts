import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import {
    getEngineSummaryRoute,
    listNodeReleasesRoute,
    getProjectEngineChecksRoute,
    getProjectEngineStalenessRoute,
    scanProjectEnginesRoute,
    bulkScanEnginesRoute
} from "#shared/routes/index.js";
import {
    GetEngineSummaryUseCase,
    ListNodeReleasesUseCase,
    GetProjectEngineChecksUseCase,
    GetProjectEngineStalenessUseCase,
    ScanProjectEnginesUseCase,
    BulkScanEnginesUseCase
} from "./useCases/engines/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function engineRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    // Registered before "/:projectId" so they aren't shadowed by that param route.
    registerRoute(app, getEngineSummaryRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(GetEngineSummaryUseCase);
        const result = await useCase.execute({});

        return send.one({ result });
    });

    registerRoute(app, listNodeReleasesRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ListNodeReleasesUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(app, bulkScanEnginesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(BulkScanEnginesUseCase);
        const result = await useCase.execute({ projectIds: request.body.projectIds });

        return send.list({ result });
    });

    registerRoute(app, getProjectEngineChecksRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectEngineChecksUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return send.list({ result });
    });

    registerRoute(app, getProjectEngineStalenessRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectEngineStalenessUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return send.one({ result });
    });

    registerRoute(app, scanProjectEnginesRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ScanProjectEnginesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            ...(request.query.warnMaintenance !== undefined && {
                warnMaintenance: request.query.warnMaintenance
            })
        });

        return send.one({ result });
    });
}
