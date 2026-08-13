import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
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
    registerRoute(app, exportProjectsRoute, {}, async (_request, reply) => {
        const useCase = container.resolve(ExportProjectsUseCase);
        const result = await useCase.execute({});

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        importProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ImportProjectsUseCase);
            const result = await useCase.execute({ items: request.body.items });

            result.match({
                ok: data => sendList({ reply, items: data.items, total: data.total }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        cloneProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CloneProjectUseCase);
            const result = await useCase.execute({
                url: request.body.url,
                destination: request.body.destination,
                folderName: request.body.folderName
            });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        bulkScanProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(BulkScanProjectsUseCase);
            const result = await useCase.execute({
                projectIds: request.body.projectIds,
                force: request.body.force
            });

            result.match({
                ok: data => {
                    reply.send(data);
                },
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
