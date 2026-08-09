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
import { UserService } from "#api/services/Auth/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import type { IAuthenticatedRequest } from "#api/middleware/authHook.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

const FULL_PERMISSION = "full";

export async function userRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const userService = container.resolve(UserService);
    const authService = container.resolve(AuthService);
    const broadcaster = container.resolve(WebSocketBroadcaster);

    registerRoute(app, listUsersRoute, {}, async (request, reply) => {
        const { search, isActive, page, pageSize, sortBy, sortOrder } = request.query;

        // Built up conditionally (rather than a single object literal with
        // `search: search ?? undefined`) because exactOptionalPropertyTypes
        // treats an explicit `undefined` value differently from an absent key.
        const listParams: UserService.ListParams = { page, pageSize, sortBy, sortOrder };
        if (search !== undefined) {
            listParams.search = search;
        }
        if (isActive !== undefined) {
            listParams.isActive = isActive;
        }

        const result = await userService.list(listParams);
        sendList(reply, result.items, result.total);
    });

    registerRoute(app, getUserRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const user = await userService.getById(id);
        if (!user) {
            sendError(reply, 404, "User not found");
            return;
        }

        sendOne(reply, user);
    });

    registerRoute(
        app,
        createUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const user = await userService.create(request.body);
            sendOne(reply, user, 201);
        }
    );

    registerRoute(app, updateUserRoute, {}, async (request, reply) => {
        const { id } = request.params;
        const { user: sessionUser } = request as IAuthenticatedRequest;
        const { displayName, password, permission, isActive } = request.body;

        const existing = await userService.getById(id);
        if (!existing) {
            sendError(reply, 404, "User not found");
            return;
        }

        const isSelf = id === sessionUser.id;
        if (!isSelf && sessionUser.permission !== FULL_PERMISSION) {
            sendError(reply, 403, "Insufficient permission");
            return;
        }

        // Self-service updates are restricted to displayName + password —
        // only a full-permission user acting on someone else's account may
        // change permission or active status.
        const data: UserService.UpdateData = {};
        if (displayName !== undefined) {
            data.displayName = displayName;
        }
        if (password !== undefined) {
            data.password = password;
        }
        if (!isSelf) {
            if (permission !== undefined) {
                data.permission = permission;
            }
            if (isActive !== undefined) {
                data.isActive = isActive;
            }
        }

        const updated = await userService.update({ id, data });
        if (!updated) {
            sendError(reply, 404, "User not found");
            return;
        }
        sendOne(reply, updated);
    });

    registerRoute(
        app,
        deleteUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const { id } = request.params;
            const { user: sessionUser } = request as IAuthenticatedRequest;

            if (id === sessionUser.id) {
                sendError(reply, 400, "Cannot delete your own account");
                return;
            }

            const existing = await userService.getById(id);
            if (!existing) {
                sendError(reply, 404, "User not found");
                return;
            }

            await userService.deactivate(id);
            await authService.forceLogout(id);
            broadcaster.closeConnectionsForUser(id);

            sendNone(reply);
        }
    );

    registerRoute(
        app,
        forceLogoutUserRoute,
        { preHandler: requirePermission(FULL_PERMISSION) },
        async (request, reply) => {
            const { id } = request.params;
            const { user: sessionUser } = request as IAuthenticatedRequest;

            if (id === sessionUser.id) {
                sendError(reply, 400, "Cannot force-logout your own account");
                return;
            }

            const existing = await userService.getById(id);
            if (!existing) {
                sendError(reply, 404, "User not found");
                return;
            }

            await authService.forceLogout(id);
            broadcaster.closeConnectionsForUser(id);

            sendNone(reply);
        }
    );
}
