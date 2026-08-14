import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList } from "#shared/routing/index.js";
import type {
    EngineSummary,
    EngineScanResult,
    ListNodeReleasesResponse,
    GetProjectEngineChecksResponse,
    GetProjectEngineStalenessResponse,
    BulkScanEnginesResponse
} from "#shared/responses/engines.js";
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
    registerRoute(app, getEngineSummaryRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetEngineSummaryUseCase);
        const result = await useCase.execute({});

        return sendOne<EngineSummary>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, listNodeReleasesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListNodeReleasesUseCase);
        const result = await useCase.execute({});

        return sendList<ListNodeReleasesResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, bulkScanEnginesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(BulkScanEnginesUseCase);
        const result = await useCase.execute({ projectIds: request.body.projectIds });

        return sendList<BulkScanEnginesResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, getProjectEngineChecksRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectEngineChecksUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return sendList<GetProjectEngineChecksResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, getProjectEngineStalenessRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectEngineStalenessUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        return sendOne<GetProjectEngineStalenessResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, scanProjectEnginesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ScanProjectEnginesUseCase);
        const result = await useCase.execute({
            projectId: request.params.projectId,
            ...(request.query.warnMaintenance !== undefined && {
                warnMaintenance: request.query.warnMaintenance
            })
        });

        return sendOne<EngineScanResult>({
            reply,
            request,
            result
        });
    });
}
