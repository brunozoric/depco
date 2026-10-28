import type { FastifyInstance } from "fastify";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { ListLogsUseCase, DeleteLogsUseCase } from "./useCases/logs/index.js";

export async function logsRoutes(app: FastifyInstance): Promise<void> {
    registerRoute(app, listLogsRoute, {}, async (request, _reply, send) => {
        const useCase = request.container.resolve(ListLogsUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(
        app,
        deleteLogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = request.container.resolve(DeleteLogsUseCase);
            const result = await useCase.execute(request.body);

            return send.list({ result });
        }
    );
}
