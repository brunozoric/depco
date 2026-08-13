import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import {
    getEngineSummaryRoute,
    listNodeReleasesRoute,
    getProjectEngineChecksRoute,
    getProjectEngineStalenessRoute,
    scanProjectEnginesRoute
} from "#shared/routes/index.js";
import {
    GetEngineSummaryUseCase,
    ListNodeReleasesUseCase,
    GetProjectEngineChecksUseCase,
    GetProjectEngineStalenessUseCase,
    ScanProjectEnginesUseCase
} from "./useCases/engines/index.js";

export async function engineRoutes(
    app: FastifyInstance,
    { container }: { container: Container }
): Promise<void> {
    // Registered before "/:projectId" so they aren't shadowed by that param route.
    registerRoute(app, getEngineSummaryRoute, {}, async (_request, reply) => {
        const useCase = container.resolve(GetEngineSummaryUseCase);
        const result = await useCase.execute({});

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, listNodeReleasesRoute, {}, async (_request, reply) => {
        const useCase = container.resolve(ListNodeReleasesUseCase);
        const result = await useCase.execute({});

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getProjectEngineChecksRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectEngineChecksUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getProjectEngineStalenessRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectEngineStalenessUseCase);
        const result = await useCase.execute({ projectId: request.params.projectId });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
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

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });
}
