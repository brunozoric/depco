import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listTeamsRoute,
    createTeamRoute,
    updateTeamRoute,
    deleteTeamRoute,
    getTeamDetailRoute,
    setTeamProjectsRoute
} from "#shared/routes/index.js";
import {
    ListTeamsUseCase,
    CreateTeamUseCase,
    GetTeamUseCase,
    UpdateTeamUseCase,
    SetTeamProjectsUseCase,
    DeleteTeamUseCase
} from "./useCases/teams/index.js";

export async function teamsRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listTeamsRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListTeamsUseCase);
        const result = await useCase.execute({
            page: request.query.page,
            pageSize: request.query.pageSize
        });

        return send.list({ result });
    });

    registerRoute(
        app,
        createTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateTeamUseCase);
            const result = await useCase.execute(request.body);

            return send.one({ result, status: 201 });
        }
    );

    registerRoute(app, getTeamDetailRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetTeamUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.one({ result });
    });

    registerRoute(
        app,
        updateTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdateTeamUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                name: request.body.name,
                color: request.body.color
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        setTeamProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(SetTeamProjectsUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                projectIds: request.body.projectIds
            });

            return send.none({ result });
        }
    );

    registerRoute(
        app,
        deleteTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteTeamUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return send.none({ result, status: 204 });
        }
    );
}
