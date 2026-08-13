import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
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

    registerRoute(app, listScanSchedulesRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListScanSchedulesUseCase);
        const result = await useCase.execute({});

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        upsertScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpsertScanScheduleUseCase);
            const result = await useCase.execute({
                projectId: request.params.projectId,
                interval: request.body.interval
            });

            return sendOne({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(
        app,
        deleteScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteScanScheduleUseCase);
            const result = await useCase.execute({ projectId: request.params.projectId });

            return sendNone({
                reply,
                request,
                status: 204,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(app, getScanScheduleDefaultRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetScanScheduleDefaultUseCase);
        const result = await useCase.execute({});

        return sendOne({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        upsertScanScheduleDefaultRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpsertScanScheduleDefaultUseCase);
            const result = await useCase.execute({ interval: request.body.interval });

            return sendOne({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
