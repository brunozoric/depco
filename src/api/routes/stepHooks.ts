import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listStepHooksRoute,
    createStepHookRoute,
    updateStepHookRoute,
    deleteStepHookRoute
} from "#shared/routes/index.js";
import {
    ListStepHooksUseCase,
    CreateStepHookUseCase,
    UpdateStepHookUseCase,
    DeleteStepHookUseCase
} from "./useCases/stepHooks/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function stepHooksRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;

    registerRoute(app, listStepHooksRoute, {}, async (request, _reply, send) => {
        const useCase = container.resolve(ListStepHooksUseCase);
        const result = await useCase.execute({ projectId: request.params.id });

        return send.list({ result });
    });

    registerRoute(
        app,
        createStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(CreateStepHookUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                position: request.body.position,
                name: request.body.name,
                command: request.body.command,
                type: request.body.type,
                required: request.body.required
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        updateStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(UpdateStepHookUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                hookId: request.params.hookId,
                name: request.body.name,
                command: request.body.command,
                type: request.body.type,
                required: request.body.required,
                enabled: request.body.enabled,
                sortOrder: request.body.sortOrder
            });

            return send.one({ result });
        }
    );

    registerRoute(
        app,
        deleteStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, _reply, send) => {
            const useCase = container.resolve(DeleteStepHookUseCase);
            const result = await useCase.execute({
                projectId: request.params.id,
                hookId: request.params.hookId
            });

            return send.list({ result });
        }
    );
}
