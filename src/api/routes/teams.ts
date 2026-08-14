import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone } from "#shared/routing/index.js";
import type {
    ListTeamsResponse,
    CreateTeamResponse,
    GetTeamDetailResponse,
    UpdateTeamResponse
} from "#shared/responses/teams.js";
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

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function teamsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listTeamsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListTeamsUseCase);
        const result = await useCase.execute({
            page: request.query.page,
            pageSize: request.query.pageSize
        });

        return sendList<ListTeamsResponse>({ reply, request, result });
    });

    registerRoute(
        app,
        createTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateTeamUseCase);
            const result = await useCase.execute(request.body);

            return sendOne<CreateTeamResponse>({
                reply,
                request,
                result,
                status: 201
            });
        }
    );

    registerRoute(app, getTeamDetailRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetTeamUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return sendOne<GetTeamDetailResponse>({ reply, request, result });
    });

    registerRoute(
        app,
        updateTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpdateTeamUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                name: request.body.name,
                color: request.body.color
            });

            return sendOne<UpdateTeamResponse>({ reply, request, result });
        }
    );

    registerRoute(
        app,
        setTeamProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(SetTeamProjectsUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                projectIds: request.body.projectIds
            });

            return sendNone({ reply, request, result });
        }
    );

    registerRoute(
        app,
        deleteTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteTeamUseCase);
            const result = await useCase.execute({ id: request.params.id });

            return sendNone({ reply, request, result, status: 204 });
        }
    );
}
