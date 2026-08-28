import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listScanSchedulesRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute,
    getScanScheduleDefaultRoute,
    upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import {
    ListScanSchedulesUseCase,
    UpsertScanScheduleUseCase,
    DeleteScanScheduleUseCase,
    GetScanScheduleDefaultUseCase,
    UpsertScanScheduleDefaultUseCase
} from "./useCases/scanSchedules/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function scanScheduleRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, listScanSchedulesRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ListScanSchedulesUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        upsertScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpsertScanScheduleUseCase);
            const result = await useCase.execute({
                projectId: request.params.projectId,
                interval: request.body.interval
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        deleteScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteScanScheduleUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return send.none({ result, status: 204 });
        }
    );

    registerRoute(app, getScanScheduleDefaultRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(GetScanScheduleDefaultUseCase);
        const result = await useCase.execute({});

        return send.one({ result });
    });

    registerRoute(
        app,
        upsertScanScheduleDefaultRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpsertScanScheduleDefaultUseCase);
            const result = await useCase.execute({ interval: request.body.interval });

            return send.one({ result });
        }
    );
}
