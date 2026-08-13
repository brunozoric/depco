import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { ListAppSettingsUseCase, UpsertAppSettingUseCase } from "./useCases/settings/index.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function appSettingsRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;

    registerRoute(app, listAppSettingsRoute, {}, async (request, reply) => {
        const useCase = container.resolve(ListAppSettingsUseCase);
        const result = await useCase.execute({});

        return sendList({
            reply,
            request,
            result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
        });
    });

    registerRoute(
        app,
        upsertAppSettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(UpsertAppSettingUseCase);
            const result = await useCase.execute({
                key: request.params.key,
                value: request.body.value
            });

            return sendOne({
                reply,
                request,
                result: result.mapError(error => ({ ...error, code: "UNKNOWN" }))
            });
        }
    );
}
