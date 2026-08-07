import { createHash } from "crypto";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendNone, sendError } from "#shared/routing/index.js";
import {
    loginRoute,
    verifyCodeRoute,
    magicLinkRoute,
    verifyMagicLinkRoute,
    getMeRoute,
    logoutRoute
} from "#shared/routes/index.js";
import { AuthService } from "#api/services/abstractions/AuthService.js";
import { UserService } from "#api/services/abstractions/UserService.js";
import type { IAuthenticatedRequest } from "#api/middleware/authHook.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IServiceError {
    statusCode?: number;
    message?: string;
}

function toStatusAndMessage(error: unknown, fallbackMessage: string): [number, string] {
    const { statusCode, message } = error as IServiceError;
    return [statusCode ?? 500, message ?? fallbackMessage];
}

export async function authRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const authService = container.resolve(AuthService);
    const userService = container.resolve(UserService);

    registerRoute(app, loginRoute, {}, async (request, reply) => {
        try {
            await authService.login(request.body);
            sendNone(reply);
        } catch (error) {
            const [statusCode, message] = toStatusAndMessage(error, "Login failed");
            sendError(reply, statusCode, message);
        }
    });

    registerRoute(app, verifyCodeRoute, {}, async (request, reply) => {
        try {
            const result = await authService.verifyCode(request.body);
            sendOne(reply, result, 200);
        } catch (error) {
            const [statusCode, message] = toStatusAndMessage(error, "Verification failed");
            sendError(reply, statusCode, message);
        }
    });

    registerRoute(app, magicLinkRoute, {}, async (request, reply) => {
        const baseUrl = `${request.protocol}://${request.hostname}`;
        try {
            await authService.requestMagicLink({ ...request.body, baseUrl });
        } catch {
            // Silently swallow all errors — the spec requires always
            // returning success to prevent user enumeration. Errors are
            // logged inside AuthService.
        }
        sendNone(reply);
    });

    registerRoute(app, verifyMagicLinkRoute, {}, async (request, reply) => {
        try {
            const result = await authService.verifyMagicLink(request.body);
            sendOne(reply, result, 200);
        } catch (error) {
            const [statusCode, message] = toStatusAndMessage(error, "Verification failed");
            sendError(reply, statusCode, message);
        }
    });

    registerRoute(app, getMeRoute, {}, async (request, reply) => {
        const { user } = request as IAuthenticatedRequest;
        const fullUser = await userService.getById(user.id);
        if (!fullUser) {
            sendError(reply, 401, "Session expired");
            return;
        }
        sendOne(reply, fullUser, 200);
    });

    registerRoute(app, logoutRoute, {}, async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            const tokenHash = createHash("sha256").update(authHeader.slice(7)).digest("hex");
            await authService.logout(tokenHash);
        }
        sendNone(reply);
    });
}
