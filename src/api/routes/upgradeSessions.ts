import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerRoute } from "#shared/routing/index.js";
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

export async function upgradeSessionRoutes(
    app: FastifyInstance,
    options: IPluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(
        app,
        createUpgradeSessionRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateUpgradeSessionUseCase);
            const result = await useCase.execute({ projectId: request.params.id });

            return send.one({ result });
        }
    );

    registerRoute(app, getUpgradeSessionRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(GetUpgradeSessionUseCase);
        const result = await useCase.execute({
            projectId: request.params.id,
            sessionId: request.params.sessionId
        });

        return send.one({ result });
    });

    registerRoute(
        app,
        executeUpgradeStepRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(ExecuteUpgradeStepUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId,
                stepType: request.params.stepType,
                input: request.body
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        skipUpgradeStepRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(SkipUpgradeStepUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId,
                stepType: request.params.stepType
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        abortUpgradeSessionRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(AbortUpgradeSessionUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                sessionId: request.params.sessionId
            });

            return send.one({ result });
        }
    );
}
