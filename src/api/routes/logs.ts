import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import type { ListLogsResponse, DeleteLogsResponse } from "#shared/responses/logs.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { ListLogsUseCase, DeleteLogsUseCase } from "./useCases/logs/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function logsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listLogsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListLogsUseCase);
        const result = await useCase.execute(request.query);

        return sendList<ListLogsResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(
        app,
        deleteLogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteLogsUseCase);
            const result = await useCase.execute(request.body);

            return sendList<DeleteLogsResponse>({
                reply,
                request,
                result
            });
        }
    );
}
