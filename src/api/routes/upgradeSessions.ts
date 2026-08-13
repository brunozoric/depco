import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createUpgradeSessionRoute,
    getUpgradeSessionRoute,
    executeUpgradeStepRoute,
    skipUpgradeStepRoute,
    abortUpgradeSessionRoute
} from "#shared/routes/index.js";
import {
    CreateUpgradeSessionUseCase,
    GetUpgradeSessionUseCase,
    ExecuteUpgradeStepUseCase,
    SkipUpgradeStepUseCase,
    AbortUpgradeSessionUseCase
} from "./useCases/upgradeSessions/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function upgradeSessionRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(
        app,
        createUpgradeSessionRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(CreateUpgradeSessionUseCase);
            const result = await useCase.execute({ projectId: request.params.id });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );

    registerRoute(app, getUpgradeSessionRoute, {}, async (request, reply) => {
        const useCase = container.resolve(GetUpgradeSessionUseCase);
        const result = await useCase.execute({
            projectId: request.params.id,
            sessionId: request.params.sessionId
        });

        result.match({
            ok: data => sendOne({ reply, data }),
            fail: error =>
                sendError({ reply, statusCode: error.statusCode, message: error.message })
        });
    });

    registerRoute(
        app,
        executeUpgradeStepRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ExecuteUpgradeStepUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId,
                stepType: request.params.stepType,
                input: request.body
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
        skipUpgradeStepRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(SkipUpgradeStepUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId,
                stepType: request.params.stepType
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
        abortUpgradeSessionRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(AbortUpgradeSessionUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId
            });

            result.match({
                ok: data => sendOne({ reply, data }),
                fail: error =>
                    sendError({ reply, statusCode: error.statusCode, message: error.message })
            });
        }
    );
}
