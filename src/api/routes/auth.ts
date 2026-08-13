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
import type { IAuthenticatedRequest } from "#api/middleware/authHook.js";
import {
    LoginUseCase,
    VerifyCodeUseCase,
    RequestMagicLinkUseCase,
    VerifyMagicLinkUseCase,
    GetMeUseCase,
    LogoutUseCase
} from "./useCases/auth/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function authRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(
        app,
        loginRoute,
        {
            config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
        },
        async (request, reply) => {
            const useCase = container.resolve(LoginUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: () => sendNone(reply),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        verifyCodeRoute,
        {
            config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
        },
        async (request, reply) => {
            const useCase = container.resolve(VerifyCodeUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => sendOne({ reply, data, status: 200 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(
        app,
        magicLinkRoute,
        {
            config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
        },
        async (request, reply) => {
            const baseUrl = `${request.protocol}://${request.hostname}`;
            const useCase = container.resolve(RequestMagicLinkUseCase);
            await useCase.execute({ ...request.body, baseUrl });
            sendNone(reply);
        }
    );

    registerRoute(
        app,
        verifyMagicLinkRoute,
        {
            config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
        },
        async (request, reply) => {
            const useCase = container.resolve(VerifyMagicLinkUseCase);
            const result = await useCase.execute(request.body);

            result.match({
                ok: data => sendOne({ reply, data, status: 200 }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, getMeRoute, {}, async (request, reply) => {
        const { user } = request as IAuthenticatedRequest;
        const useCase = container.resolve(GetMeUseCase);
        const result = await useCase.execute({ userId: user.id });

        result.match({
            ok: data => sendOne({ reply, data, status: 200 }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(app, logoutRoute, {}, async (request, reply) => {
        const useCase = container.resolve(LogoutUseCase);
        await useCase.execute({ authorizationHeader: request.headers.authorization });
        sendNone(reply);
    });
}
