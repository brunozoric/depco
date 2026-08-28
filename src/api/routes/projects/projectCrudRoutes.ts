import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute,
    updateProjectRoute
} from "#shared/routes/index.js";
import {
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    DeleteProjectUseCase,
    UpdateProjectUseCase
} from "../useCases/projects/index.js";

export function registerProjectCrudRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(
        app,
        createProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateProjectUseCase);
            const result = await useCase.execute({ projectPath: request.body.path });

            return send.one({ result, status: 201 });
        }
    );

    registerRoute(app, listProjectsRoute, {}, async (request, _reply, send) => {
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

        return send.list({ result });
    });

    registerRoute(app, getProjectRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetProjectUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.one({ result });
    });

    registerRoute(
        app,
        deleteProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteProjectUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return send.none({ result, status: 204 });
        }
    );

    registerRoute(
        app,
        updateProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdateProjectUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                name: request.body.name
            });

            return send.one({ result });
        }
    );
}
