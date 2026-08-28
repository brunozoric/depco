import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
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

    registerRoute(app, listUsersRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListUsersUseCase);
        const result = await useCase.execute(request.query);

        return send.list({ result });
    });

    registerRoute(app, getUserRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetUserUseCase);
        const result = await useCase.execute({ id: request.params.id });

        return send.one({ result });
    });

    registerRoute(
        app,
        createUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateUserUseCase);
            const result = await useCase.execute(request.body);

            return send.one({ result, status: 201 });
        }
    );

    registerRoute(app, updateUserRoute, {}, async (request, _reply, send) => {
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

        return send.one({ result });
    });

    registerRoute(
        app,
        deleteUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, _reply, send) => {
            const { user: sessionUser } = request as IAuthenticatedRequest;
            const useCase = container.resolve(DeleteUserUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                sessionUserId: sessionUser.id
            });

            return send.none({ result });
        }
    );

    registerRoute(
        app,
        forceLogoutUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, _reply, send) => {
            const { user: sessionUser } = request as IAuthenticatedRequest;
            const useCase = container.resolve(ForceLogoutUserUseCase);
            const result = await useCase.execute({
                id: request.params.id,
                sessionUserId: sessionUser.id
            });

            return send.none({ result });
        }
    );
}
