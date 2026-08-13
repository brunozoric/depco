import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendNone } from "#shared/routing/index.js";
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

            return sendNone({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
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

            return sendOne({
                reply,
                request,
                status: 200,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
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
            const result = await useCase.execute({ ...request.body, baseUrl });

            return sendNone({
                reply,
                request,
                result: result.mapError(() => ({
                    code: "UNKNOWN",
                    statusCode: 500,
                    message: "Unknown error"
                }))
            });
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

            return sendOne({
                reply,
                request,
                status: 200,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );

    registerRoute(app, getMeRoute, {}, async (request, reply) => {
        const { user } = request as IAuthenticatedRequest;
        const useCase = container.resolve(GetMeUseCase);
        const result = await useCase.execute({ userId: user.id });

        return sendOne({
            reply,
            request,
            status: 200,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(app, logoutRoute, {}, async (request, reply) => {
        const useCase = container.resolve(LogoutUseCase);
        const result = await useCase.execute({
            authorizationHeader: request.headers.authorization
        });

        return sendNone({
            reply,
            request,
            result: result.mapError(() => ({
                code: "UNKNOWN",
                statusCode: 500,
                message: "Unknown error"
            }))
        });
    });
}
