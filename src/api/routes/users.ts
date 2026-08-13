import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendNone, sendError } from "#shared/routing/index.js";
import {
    listUsersRoute,
    getUserRoute,
    createUserRoute,
    updateUserRoute,
    deleteUserRoute,
    forceLogoutUserRoute
} from "#shared/routes/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import type { IAuthenticatedRequest } from "#api/middleware/authHook.js";
import {
    ListUsersUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ForceLogoutUserUseCase
} from "./useCases/users/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

const FULL_PERMISSION = "full";

export async function userRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listUsersRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListUsersUseCase);
        const result = await useCase.execute(request.query);

        result.match({
            ok: data => sendList({ reply, items: data.items, total: data.total }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, getUserRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetUserUseCase);
        const result = await useCase.execute({ id: request.params.id });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        createUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const useCase = container.resolve(CreateUserUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => sendOne({ reply, data, status: 201 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, updateUserRoute, {}, async (request, reply) => {
        const { user: sessionUser } = request as IAuthenticatedRequest;
        const useCase = container.resolve(UpdateUserUseCase);
        const result = await useCase.execute({
            id: request.params.id,
            sessionUserId: sessionUser.id,
            sessionUserPermission: sessionUser.permission,
            displayName: request.body.displayName,
            password: request.body.password,
            permission: request.body.permission,
            isActive: request.body.isActive
        });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        deleteUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const { user: sessionUser } = request as IAuthenticatedRequest;
            const useCase = container.resolve(DeleteUserUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                sessionUserId: sessionUser.id
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
        forceLogoutUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const { user: sessionUser } = request as IAuthenticatedRequest;
            const useCase = container.resolve(ForceLogoutUserUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                sessionUserId: sessionUser.id
            });

            result.match({
                ok: () => sendNone(reply),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
