import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
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

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        createTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateTeamUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => sendOne({ reply, data, status: 201 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, getTeamDetailRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetTeamUseCase);
        const result = await useCase.execute({ id: request.params.id });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
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

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
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

            result.match({
                ok: () => sendNone(reply),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        deleteTeamRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(DeleteTeamUseCase);
            const result = await useCase.execute({ id: request.params.id });

            result.match({
                ok: () => sendNone(reply, 204),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
