import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
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

            return sendOne({
                reply,
                request,
                status: 201,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(app, listProjectsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListProjectsUseCase);
        const result = await useCase.execute({
            page: request.query.page,
            pageSize: request.query.pageSize,
            search: request.query.search,
            teamId: request.query.teamId
        });

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, getProjectRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendOne({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        deleteProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteProjectUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return sendNone({
                reply,
                request,
                status: 204,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
