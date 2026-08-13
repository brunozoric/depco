import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute
} from "#shared/routes/index.js";
import {
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    DeleteProjectUseCase
} from "../useCases/projects/index.js";

export function registerProjectCrudRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(
        app,
        createProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateProjectUseCase);
            const result = await useCase.execute({ projectPath: request.body.path });

            result.match({
                ok: data => sendOne({ reply, data, status: 201 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, listProjectsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListProjectsUseCase);
        const result = await useCase.execute({
            page: request.query.page,
            pageSize: request.query.pageSize
        });

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getProjectRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectUseCase);
        const result = await useCase.execute({ id: request.params.id });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        deleteProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteProjectUseCase);
            const result = await useCase.execute({ id: request.params.id });

            result.match({
                ok: () => sendNone(reply, 204),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
