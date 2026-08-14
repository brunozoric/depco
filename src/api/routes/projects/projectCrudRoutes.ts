import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import type {
    CreateProjectResponse,
    ListProjectsResponse,
    GetProjectResponse
} from "#shared/responses/index.js";
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

            return sendOne<CreateProjectResponse>({
                reply,
                request,
                status: 201,
                result
            });
        }
    );

    registerRoute(app, listProjectsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListProjectsUseCase);
        const result = await useCase.execute({
            page: request.query.page,
            pageSize: request.query.pageSize,
            search: request.query.search,
            teamId: request.query.teamId,
            sortBy: request.query.sortBy,
            sortOrder: request.query.sortOrder,
            engineStatus: request.query.engineStatus
        });

        return sendList<ListProjectsResponse>({
            reply,
            request,
            result
        });
    });

    registerRoute(app, getProjectRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetProjectUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendOne<GetProjectResponse>({
            reply,
            request,
            result
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
                result
            });
        }
    );
}
