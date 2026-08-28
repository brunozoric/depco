import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
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
        async (request, _reply, send) => {
            const useCase = container.resolve(LoginUseCase);
            const result = await useCase.execute(request.body);

            return send.none({ result });
        }
    );

    registerRoute(
        app,
        verifyCodeRoute,
        {
            config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
        },
        async (request, _reply, send) => {
            const useCase = container.resolve(VerifyCodeUseCase);
            const result = await useCase.execute(request.body);

            return send.one({ status: 200, result });
        }
    );

    registerRoute(
        app,
        magicLinkRoute,
        {
            config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
        },
        async (request, _reply, send) => {
            const baseUrl = `${request.protocol}://${request.hostname}`;
            const useCase = container.resolve(RequestMagicLinkUseCase);
            const result = await useCase.execute({ ...request.body, baseUrl });

            return send.none({ result });
        }
    );

    registerRoute(
        app,
        verifyMagicLinkRoute,
        {
            config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
        },
        async (request, _reply, send) => {
            const useCase = container.resolve(VerifyMagicLinkUseCase);
            const result = await useCase.execute(request.body);

            return send.one({ status: 200, result });
        }
    );

    registerRoute(app, getMeRoute, {}, async (request, _reply, send) => {
        const { user } = request as IAuthenticatedRequest;
        const useCase = container.resolve(GetMeUseCase);
        const result = await useCase.execute({ userId: user.id });

        return send.one({ status: 200, result });
    });

    registerRoute(app, logoutRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(LogoutUseCase);
        const result = await useCase.execute({
            authorizationHeader: request.headers.authorization
        });

        return send.none({ result });
    });
}
