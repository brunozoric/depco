import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { ListLogsUseCase, DeleteLogsUseCase } from "./useCases/logs/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function logsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listLogsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListLogsUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(
        app,
        deleteLogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteLogsUseCase);
            const result = await useCase.execute(request.body);

            return send.list({ result });
        }
    );
}
