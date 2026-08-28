import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    exportProjectsRoute,
    importProjectsRoute,
    cloneProjectRoute,
    bulkScanProjectsRoute
} from "#shared/routes/index.js";
import {
    ExportProjectsUseCase,
    ImportProjectsUseCase,
    CloneProjectUseCase,
    BulkScanProjectsUseCase
} from "../useCases/projects/index.js";

export function registerProjectBulkRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, exportProjectsRoute, {}, async (_request, _reply, send) => {
        const useCase = container.resolve(ExportProjectsUseCase);
        const result = await useCase.execute({});

        return send.list({ result });
    });

    registerRoute(
        app,
        importProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ImportProjectsUseCase);
            const result = await useCase.execute({ items: request.body.items });

            return send.list({ result });
        }
    );

    registerRoute(
        app,
        cloneProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CloneProjectUseCase);
            const result = await useCase.execute({
                url: request.body.url,
                destination: request.body.destination,
                folderName: request.body.folderName
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        bulkScanProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(BulkScanProjectsUseCase);
            const result = await useCase.execute({
                projectIds: request.body.projectIds,
                force: request.body.force
            });

            return send.list({ result });
        }
    );
}
