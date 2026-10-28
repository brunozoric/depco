import type { FastifyInstance } from "fastify";
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

export async function scanScheduleRoutes(app: FastifyInstance): Promise<void> {
    registerRoute(app, listScanSchedulesRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(ListScanSchedulesUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        upsertScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(UpsertScanScheduleUseCase);
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
            const useCase = request.container.resolve(DeleteScanScheduleUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return send.none({ result, status: 204 });
        }
    );

    registerRoute(app, getScanScheduleDefaultRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(GetScanScheduleDefaultUseCase);
        const result = await useCase.execute({});

        return send.one({ result });
    });

    registerRoute(
        app,
        upsertScanScheduleDefaultRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(UpsertScanScheduleDefaultUseCase);
            const result = await useCase.execute({ interval: request.body.interval });

            return send.one({ result });
        }
    );
}
